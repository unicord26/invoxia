"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { computeInvoice, formatINR, rupeesToPaise } from "@invoixe/core";
import { GST_RATES, type Item, type Party } from "@invoixe/types";
import { api } from "../../../lib/api";

type Business = { stateCode: string | null };
type Line = { itemId: string | null; description: string; hsnSac: string; qty: string; rateRupees: string; taxRate: number };
const blank: Line = { itemId: null, description: "", hsnSac: "", qty: "1", rateRupees: "", taxRate: 18 };

export default function NewPurchasePage() {
  const router = useRouter();
  const { data: parties } = useQuery({ queryKey: ["parties"], queryFn: () => api.get<Party[]>("/api/parties") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => api.get<Item[]>("/api/items") });
  const { data: business } = useQuery({ queryKey: ["business"], queryFn: () => api.get<Business>("/api/business/current") });

  const [partyId, setPartyId] = useState("");
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...blank }]);
  const suppliers = parties?.filter((p) => p.type === "supplier" || p.type === "both") ?? [];
  const party = parties?.find((p) => p.id === partyId) ?? null;
  const ourState = business?.stateCode ?? "27";
  const supplierState = party?.stateCode ?? ourState;

  const computed = useMemo(() => {
    const el = lines.filter((l) => Number(l.qty) > 0 && l.rateRupees !== "").map((l) => ({
      qty: Number(l.qty), rate: rupeesToPaise(Number(l.rateRupees)), taxRate: l.taxRate, hsnSac: l.hsnSac || undefined,
    }));
    return el.length ? computeInvoice({ sellerStateCode: supplierState, buyerStateCode: ourState, lines: el }) : null;
  }, [lines, supplierState, ourState]);

  const save = useMutation({
    mutationFn: () => api.post<{ id: string }>("/api/purchases", {
      partyId: partyId || null, referenceNo: refNo || null,
      lines: lines.filter((l) => Number(l.qty) > 0 && l.rateRupees !== "" && l.description.trim()).map((l) => ({
        itemId: l.itemId, description: l.description.trim(), hsnSac: l.hsnSac || null,
        qty: Number(l.qty), rate: rupeesToPaise(Number(l.rateRupees)), taxRate: l.taxRate,
      })),
    }),
    onSuccess: () => router.push("/purchases"),
  });

  const upd = (i: number, p: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  const pick = (i: number, id: string) => {
    const it = items?.find((x) => x.id === id);
    if (!it) return upd(i, { itemId: null });
    upd(i, { itemId: it.id, description: it.name, hsnSac: it.hsnSac ?? "", rateRupees: (it.purchasePrice / 100 || it.salePrice / 100).toString(), taxRate: it.taxRate });
  };
  const input = "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-green-500";
  const canSave = lines.some((l) => Number(l.qty) > 0 && l.rateRupees !== "" && l.description.trim()) && !save.isPending;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6"><Link href="/purchases" className="text-sm text-green-700 hover:underline">← Purchases</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">New Purchase Bill</h1></header>

      <div className="mb-6 grid gap-3 rounded-xl border border-green-200 bg-white p-4 sm:grid-cols-2">
        <div><label className="mb-1 block text-xs font-medium text-gray-600">Supplier</label>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className={input}>
            <option value="">— select supplier —</option>
            {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div><label className="mb-1 block text-xs font-medium text-gray-600">Supplier bill no.</label>
          <input value={refNo} onChange={(e) => setRefNo(e.target.value)} className={input} placeholder="26-27 / 143" /></div>
      </div>

      <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
          <th className="px-3 py-2">Item</th><th className="px-3 py-2">HSN</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Rate ₹</th><th className="px-3 py-2">GST</th><th className="px-3 py-2"></th>
        </tr></thead><tbody>
          {lines.map((l, i) => (<tr key={i} className="border-b border-gray-50">
            <td className="px-3 py-2 min-w-[220px]">
              {items && items.length > 0 && <select value={l.itemId ?? ""} onChange={(e) => pick(i, e.target.value)} className={`${input} mb-1`}>
                <option value="">— pick / type —</option>{items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select>}
              <input value={l.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Description" className={input} /></td>
            <td className="px-3 py-2"><input value={l.hsnSac} onChange={(e) => upd(i, { hsnSac: e.target.value })} className={`${input} w-24`} /></td>
            <td className="px-3 py-2"><input type="number" step="any" value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} className={`${input} w-20`} /></td>
            <td className="px-3 py-2"><input type="number" step="0.01" value={l.rateRupees} onChange={(e) => upd(i, { rateRupees: e.target.value })} className={`${input} w-24`} /></td>
            <td className="px-3 py-2"><select value={l.taxRate} onChange={(e) => upd(i, { taxRate: Number(e.target.value) })} className={`${input} w-20`}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></td>
            <td className="px-3 py-2 text-right">{lines.length > 1 && <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-gray-400 hover:text-red-600">✕</button>}</td>
          </tr>))}
        </tbody></table>
        <button onClick={() => setLines((p) => [...p, { ...blank }])} className="m-3 rounded-lg border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50">+ Add line</button>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="w-full max-w-xs rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Taxable</span><span>{computed ? formatINR(computed.totals.subTotal) : "—"}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{computed ? formatINR(computed.totals.totalTax) : "—"}</span></div>
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-base font-extrabold text-green-700"><span>Grand Total</span><span>{computed ? formatINR(computed.totals.grandTotal) : "₹0.00"}</span></div>
        </div>
        <button onClick={() => save.mutate()} disabled={!canSave} className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{save.isPending ? "Saving…" : "Save purchase"}</button>
        {save.error && <span className="text-sm text-red-600">{String(save.error.message)}</span>}
      </div>
    </main>
  );
}
