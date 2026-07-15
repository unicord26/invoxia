"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { computeInvoice, formatINR } from "@invoixe/core";
import type { Item, Party } from "@invoixe/types";
import { api } from "../../lib/api";

type Cart = Record<string, number>; // itemId -> qty

export default function PosPage() {
  const router = useRouter();
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => api.get<(Item & { currentStock: number })[]>("/api/items") });
  const { data: parties } = useQuery({ queryKey: ["parties"], queryFn: () => api.get<Party[]>("/api/parties") });
  const [cart, setCart] = useState<Cart>({});
  const [partyId, setPartyId] = useState("");
  const [q, setQ] = useState("");

  const list = (items ?? []).filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  const cartItems = Object.entries(cart).map(([id, qty]) => ({ item: items?.find((i) => i.id === id)!, qty })).filter((c) => c.item);

  const total = useMemo(() => {
    const lines = cartItems.map((c) => ({ qty: c.qty, rate: c.item.salePrice, taxRate: c.item.taxRate }));
    return lines.length ? computeInvoice({ sellerStateCode: "27", buyerStateCode: "27", lines }).totals.grandTotal : 0;
  }, [cartItems]);

  const add = (id: string, d = 1) => setCart((c) => { const n = (c[id] ?? 0) + d; const next = { ...c }; if (n <= 0) delete next[id]; else next[id] = n; return next; });

  const charge = useMutation({
    mutationFn: () => api.post<{ id: string }>("/api/invoices", {
      partyId: partyId || null,
      lines: cartItems.map((c) => ({ itemId: c.item.id, description: c.item.name, hsnSac: c.item.hsnSac ?? null, qty: c.qty, rate: c.item.salePrice, taxRate: c.item.taxRate })),
    }),
    onSuccess: (inv) => router.push(`/invoices/${inv.id}/thermal`),
  });

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
      {/* items */}
      <div>
        <header className="mb-4 flex items-center justify-between">
          <div><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
            <h1 className="text-2xl font-extrabold text-gray-900">POS</h1></div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500" />
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((it) => (
            <button key={it.id} onClick={() => add(it.id)} className="rounded-xl border border-green-200 bg-white p-3 text-left transition hover:border-green-500 hover:shadow">
              <div className="line-clamp-2 text-sm font-medium text-gray-900">{it.name}</div>
              <div className="mt-1 text-sm font-bold text-green-700">{formatINR(it.salePrice)}</div>
              <div className="text-xs text-gray-400">{it.taxRate}% GST</div>
            </button>
          ))}
          {list.length === 0 && <p className="text-sm text-gray-500">No items. Add some in Items first.</p>}
        </div>
      </div>

      {/* cart */}
      <aside className="sticky top-6 h-fit rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Cart</h2>
        <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500">
          <option value="">Cash customer</option>
          {parties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="mb-3 max-h-72 space-y-2 overflow-auto">
          {cartItems.map((c) => (
            <div key={c.item.id} className="flex items-center justify-between text-sm">
              <div className="flex-1 truncate">{c.item.name}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => add(c.item.id, -1)} className="h-6 w-6 rounded bg-gray-100 text-gray-700">−</button>
                <span className="w-6 text-center">{c.qty}</span>
                <button onClick={() => add(c.item.id, 1)} className="h-6 w-6 rounded bg-green-600 text-white">+</button>
              </div>
              <div className="w-20 text-right font-medium">{formatINR(c.item.salePrice * c.qty)}</div>
            </div>
          ))}
          {cartItems.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Tap items to add</p>}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-lg font-extrabold text-green-700">
          <span>Total</span><span>{formatINR(total)}</span>
        </div>
        <button onClick={() => charge.mutate()} disabled={charge.isPending || cartItems.length === 0}
          className="mt-3 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          {charge.isPending ? "Charging…" : `Charge ${formatINR(total)}`}
        </button>
      </aside>
    </main>
  );
}
