"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Item } from "@invoixe/types";
import { api } from "../../lib/api";

type Bom = { itemId: string; lines: { rawItemId: string; qty: number }[] };

export default function ManufacturingPage() {
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => api.get<(Item & { currentStock: number })[]>("/api/items") });
  const [finishedId, setFinishedId] = useState("");
  const [rows, setRows] = useState<{ rawItemId: string; qty: string }[]>([]);
  const [produceQty, setProduceQty] = useState("");

  const { data: bom } = useQuery({
    queryKey: ["bom", finishedId],
    queryFn: () => api.get<Bom>(`/api/bom/${finishedId}`),
    enabled: !!finishedId,
  });
  useEffect(() => {
    if (bom) setRows(bom.lines.map((l) => ({ rawItemId: l.rawItemId, qty: String(l.qty) })));
  }, [bom]);

  const saveBom = useMutation({
    mutationFn: () => api.put(`/api/bom/${finishedId}`, { lines: rows.filter((r) => r.rawItemId && Number(r.qty) > 0).map((r) => ({ rawItemId: r.rawItemId, qty: Number(r.qty) })) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bom", finishedId] }),
  });

  const produce = useMutation({
    mutationFn: () => api.post("/api/production", { itemId: finishedId, qty: Number(produceQty) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); setProduceQty(""); },
  });

  const products = items?.filter((i) => i.type === "product") ?? [];
  const input = "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8"><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">Manufacturing</h1>
        <p className="text-sm text-gray-500">Bill of materials &amp; production</p></header>

      <div className="mb-6 max-w-md">
        <label className="mb-1 block text-xs font-medium text-gray-600">Finished good</label>
        <select value={finishedId} onChange={(e) => setFinishedId(e.target.value)} className={`${input} w-full`}>
          <option value="">— select item —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock {p.currentStock})</option>)}
        </select>
      </div>

      {finishedId && (
        <>
          <section className="mb-6 rounded-xl border border-green-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Bill of materials</h2>
            {rows.map((r, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <select value={r.rawItemId} onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, rawItemId: e.target.value } : x))} className={`${input} flex-1`}>
                  <option value="">— raw material —</option>
                  {products.filter((p) => p.id !== finishedId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" step="any" value={r.qty} onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x))} placeholder="Qty" className={`${input} w-24`} />
                <button onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-gray-400 hover:text-red-600">✕</button>
              </div>
            ))}
            <div className="mt-2 flex gap-3">
              <button onClick={() => setRows((p) => [...p, { rawItemId: "", qty: "" }])} className="rounded-lg border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">+ material</button>
              <button onClick={() => saveBom.mutate()} disabled={saveBom.isPending} className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Save BOM</button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Produce</h2>
            <div className="flex items-center gap-3">
              <input type="number" step="any" value={produceQty} onChange={(e) => setProduceQty(e.target.value)} placeholder="Qty to build" className={`${input} w-32`} />
              <button onClick={() => produce.mutate()} disabled={produce.isPending || !(Number(produceQty) > 0)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {produce.isPending ? "Building…" : "Build"}
              </button>
              {produce.error && <span className="text-sm text-red-600">{String(produce.error.message)}</span>}
              {produce.isSuccess && <span className="text-sm text-green-700">Produced ✓ (raw materials consumed)</span>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
