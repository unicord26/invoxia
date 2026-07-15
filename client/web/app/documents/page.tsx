"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { computeInvoice, formatINR, rupeesToPaise } from "@invoixe/core";
import { GST_RATES, type DocumentType, type Item, type Party } from "@invoixe/types";
import { api } from "../../lib/api";

const TABS: { type: DocumentType; label: string; supplier: boolean; convertible: boolean }[] = [
  { type: "estimate", label: "Estimate", supplier: false, convertible: true },
  { type: "proforma", label: "Proforma", supplier: false, convertible: true },
  { type: "sale_order", label: "Sale Order", supplier: false, convertible: true },
  { type: "purchase_order", label: "Purchase Order", supplier: true, convertible: false },
  { type: "delivery_challan", label: "Delivery Challan", supplier: false, convertible: false },
  { type: "credit_note", label: "Credit Note", supplier: false, convertible: false },
  { type: "debit_note", label: "Debit Note", supplier: true, convertible: false },
];

type Doc = { id: string; number: string; date: string; partyName: string | null; grandTotal: number; convertedToId: string | null };
type Line = { itemId: string | null; description: string; qty: string; rateRupees: string; taxRate: number };
const blank: Line = { itemId: null, description: "", qty: "1", rateRupees: "", taxRate: 18 };

export default function DocumentsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<DocumentType>("estimate");
  const cfg = TABS.find((t) => t.type === tab)!;

  const { data: parties } = useQuery({ queryKey: ["parties"], queryFn: () => api.get<Party[]>("/api/parties") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => api.get<Item[]>("/api/items") });
  const { data: docs } = useQuery({ queryKey: ["documents", tab], queryFn: () => api.get<Doc[]>(`/api/documents?type=${tab}`) });

  const [partyId, setPartyId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...blank }]);
  const pool = parties?.filter((p) => (cfg.supplier ? p.type !== "customer" : p.type !== "supplier")) ?? [];

  const total = useMemo(() => {
    const el = lines.filter((l) => Number(l.qty) > 0 && l.rateRupees !== "").map((l) => ({ qty: Number(l.qty), rate: rupeesToPaise(Number(l.rateRupees)), taxRate: l.taxRate }));
    return el.length ? computeInvoice({ sellerStateCode: "27", buyerStateCode: "27", lines: el }).totals.grandTotal : 0;
  }, [lines]);

  const save = useMutation({
    mutationFn: () => api.post("/api/documents", {
      type: tab, partyId: partyId || null,
      lines: lines.filter((l) => Number(l.qty) > 0 && l.rateRupees !== "" && l.description.trim()).map((l) => ({
        itemId: l.itemId, description: l.description.trim(), qty: Number(l.qty), rate: rupeesToPaise(Number(l.rateRupees)), taxRate: l.taxRate,
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents", tab] }); setLines([{ ...blank }]); setPartyId(""); },
  });

  const convert = useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/api/documents/${id}/convert`, {}),
    onSuccess: (inv) => router.push(`/invoices/${inv.id}`),
  });

  const upd = (i: number, p: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  const pick = (i: number, id: string) => {
    const it = items?.find((x) => x.id === id);
    if (!it) return upd(i, { itemId: null });
    upd(i, { itemId: it.id, description: it.name, rateRupees: (it.salePrice / 100).toString(), taxRate: it.taxRate });
  };
  const input = "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-green-500";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6"><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">Documents</h1></header>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.type} onClick={() => setTab(t.type)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.type ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:border-green-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* builder */}
      <div className="mb-6 rounded-xl border border-green-200 bg-white p-4">
        <div className="mb-3 max-w-md">
          <label className="mb-1 block text-xs font-medium text-gray-600">{cfg.supplier ? "Supplier" : "Customer"}</label>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className={input}>
            <option value="">— select —</option>{pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-end gap-2">
            {items && items.length > 0 && <select value={l.itemId ?? ""} onChange={(e) => pick(i, e.target.value)} className={`${input} max-w-[180px]`}>
              <option value="">— item —</option>{items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select>}
            <input value={l.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Description" className={`${input} max-w-[200px]`} />
            <input type="number" step="any" value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} placeholder="Qty" className={`${input} w-20`} />
            <input type="number" step="0.01" value={l.rateRupees} onChange={(e) => upd(i, { rateRupees: e.target.value })} placeholder="Rate ₹" className={`${input} w-24`} />
            <select value={l.taxRate} onChange={(e) => upd(i, { taxRate: Number(e.target.value) })} className={`${input} w-20`}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
            {lines.length > 1 && <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-gray-400 hover:text-red-600">✕</button>}
          </div>
        ))}
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setLines((p) => [...p, { ...blank }])} className="rounded-lg border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">+ line</button>
          <span className="text-sm text-gray-500">Total: <b className="text-green-700">{formatINR(total)}</b></span>
          <button onClick={() => save.mutate()} disabled={save.isPending || total === 0}
            className="ml-auto rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {save.isPending ? "Saving…" : `Save ${cfg.label}`}
          </button>
        </div>
      </div>

      {/* list */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{docs?.length ?? 0} {cfg.label.toLowerCase()}s</div>
        <ul className="divide-y divide-gray-100">
          {docs?.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3">
              <div><div className="font-medium text-gray-900">{d.number}</div>
                <div className="text-xs text-gray-500">{d.partyName ?? "—"} · {new Date(d.date).toLocaleDateString("en-IN")}</div></div>
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-700">{formatINR(d.grandTotal)}</span>
                {cfg.convertible && (d.convertedToId
                  ? <Link href={`/invoices/${d.convertedToId}`} className="text-xs text-green-700 hover:underline">converted →</Link>
                  : <button onClick={() => convert.mutate(d.id)} disabled={convert.isPending} className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700">→ Invoice</button>)}
              </div>
            </li>
          ))}
          {docs?.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">None yet.</li>}
        </ul>
      </section>
    </main>
  );
}
