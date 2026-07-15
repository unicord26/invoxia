"use client";

import { use, useEffect, useState } from "react";
import { formatINR } from "@invoixe/core";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type Catalog = {
  business: { name: string; phone: string | null; address: string | null };
  items: { id: string; name: string; salePrice: number; unit: string; taxRate: number }[];
};

export default function StorePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const [data, setData] = useState<Catalog | null>(null);
  const [err, setErr] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`${BASE}/api/store/${businessId}/catalog`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, [businessId]);

  if (err) return <main className="p-10 text-center text-gray-500">Store not found.</main>;
  if (!data) return <main className="p-10 text-center text-gray-500">Loading…</main>;

  const add = (id: string, d = 1) => setCart((c) => { const n = (c[id] ?? 0) + d; const nx = { ...c }; if (n <= 0) delete nx[id]; else nx[id] = n; return nx; });
  const lines = Object.entries(cart).map(([id, q]) => ({ it: data.items.find((i) => i.id === id)!, q })).filter((l) => l.it);
  const total = lines.reduce((s, l) => s + l.it.salePrice * l.q, 0);

  const order = () => {
    const msg = ["Order from " + data.business.name + ":", ...lines.map((l) => `${l.q} x ${l.it.name}`), `Total (excl. tax): ${formatINR(total)}`].join("\n");
    const phone = (data.business.phone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone ? "91" + phone : ""}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 font-extrabold text-white">LX</div>
        <div><h1 className="text-2xl font-extrabold text-green-700">{data.business.name}</h1>
          {data.business.address && <p className="text-sm text-gray-500">{data.business.address}</p>}</div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
            <div><div className="font-medium text-gray-900">{it.name}</div>
              <div className="text-sm font-bold text-green-700">{formatINR(it.salePrice)} <span className="text-xs font-normal text-gray-400">/ {it.unit}</span></div></div>
            {cart[it.id] ? (
              <div className="flex items-center gap-2">
                <button onClick={() => add(it.id, -1)} className="h-7 w-7 rounded bg-gray-100">−</button>
                <span className="w-6 text-center">{cart[it.id]}</span>
                <button onClick={() => add(it.id, 1)} className="h-7 w-7 rounded bg-green-600 text-white">+</button>
              </div>
            ) : (
              <button onClick={() => add(it.id)} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">Add</button>
            )}
          </div>
        ))}
        {data.items.length === 0 && <p className="text-sm text-gray-500">No products listed yet.</p>}
      </div>

      {lines.length > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-xl border border-green-300 bg-white p-4 shadow-lg">
          <span className="font-semibold">Total: {formatINR(total)}</span>
          <button onClick={order} className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">Order on WhatsApp</button>
        </div>
      )}
    </main>
  );
}
