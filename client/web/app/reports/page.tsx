"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@invoixe/core";
import { api } from "../../lib/api";

type Summary = { sales: number; purchases: number; expenses: number; outputTax: number; inputTax: number; grossProfit: number; receivables: number; payables: number };
type Gst = { output: { total: number }; input: { total: number }; netPayable: number };
type Outstanding = { id: string; name: string; type: string; balance: number };
type Stock = { rows: { id: string; name: string; qty: number; value: number; low: boolean }[]; totalValue: number };

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-500" : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-xl font-extrabold ${color}`}>{formatINR(value)}</div>
    </div>
  );
}

export default function ReportsPage() {
  const { data: s } = useQuery({ queryKey: ["r-summary"], queryFn: () => api.get<Summary>("/api/reports/summary") });
  const { data: gst } = useQuery({ queryKey: ["r-gst"], queryFn: () => api.get<Gst>("/api/reports/gst") });
  const { data: out } = useQuery({ queryKey: ["r-out"], queryFn: () => api.get<Outstanding[]>("/api/reports/outstanding") });
  const { data: stock } = useQuery({ queryKey: ["r-stock"], queryFn: () => api.get<Stock>("/api/reports/stock") });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8"><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">Reports</h1></header>

      {/* headline */}
      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Sales" value={s?.sales ?? 0} tone="good" />
        <Stat label="Purchases" value={s?.purchases ?? 0} />
        <Stat label="Expenses" value={s?.expenses ?? 0} tone="bad" />
        <Stat label="Gross profit" value={s?.grossProfit ?? 0} tone={(s?.grossProfit ?? 0) >= 0 ? "good" : "bad"} />
        <Stat label="Receivables" value={s?.receivables ?? 0} tone="good" />
        <Stat label="Payables" value={s?.payables ?? 0} tone="bad" />
        <Stat label="Output GST" value={s?.outputTax ?? 0} />
        <Stat label="Input GST" value={s?.inputTax ?? 0} />
      </div>

      {/* GST 3B */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">GST summary (3B)</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>Output tax: <b>{formatINR(gst?.output.total ?? 0)}</b></div>
          <div>Input tax credit: <b>{formatINR(gst?.input.total ?? 0)}</b></div>
          <div className="font-semibold">Net payable: <span className={(gst?.netPayable ?? 0) >= 0 ? "text-red-500" : "text-green-600"}>{formatINR(gst?.netPayable ?? 0)}</span></div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* outstanding */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Party outstanding</div>
          <ul className="divide-y divide-gray-100">
            {out?.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <Link href={`/parties/${r.id}`} className="text-gray-800 hover:text-green-700 hover:underline">{r.name}</Link>
                <span className={r.balance > 0 ? "font-medium text-green-600" : "font-medium text-red-500"}>
                  {formatINR(Math.abs(r.balance))} {r.balance > 0 ? "Dr" : "Cr"}
                </span>
              </li>
            ))}
            {out?.length === 0 && <li className="px-4 py-4 text-center text-sm text-gray-500">All settled.</li>}
          </ul>
        </section>

        {/* stock */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Stock summary</span><span>Value: {formatINR(stock?.totalValue ?? 0)}</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {stock?.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-800">{r.name}</span>
                <span className={r.low ? "font-medium text-red-500" : "text-gray-600"}>{r.qty}{r.low ? " low" : ""}</span>
              </li>
            ))}
            {stock?.rows.length === 0 && <li className="px-4 py-4 text-center text-sm text-gray-500">No products.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
