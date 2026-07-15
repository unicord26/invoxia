"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

type Gstr1 = { gstin: string; fp: string; gt: number; b2b: unknown[]; b2cs: unknown[] };
type InvoiceRow = { id: string; number: string; partyName: string | null };

export default function GstPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [einv, setEinv] = useState<string | null>(null);

  const { data: gstr1, refetch, isFetching } = useQuery({
    queryKey: ["gstr1", month, year],
    queryFn: () => api.get<Gstr1>(`/api/gst/gstr1?month=${month}&year=${year}`),
  });
  const { data: invoices } = useQuery({ queryKey: ["invoices"], queryFn: () => api.get<InvoiceRow[]>("/api/invoices") });

  const download = () => {
    if (!gstr1) return;
    const blob = new Blob([JSON.stringify(gstr1, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `GSTR1-${gstr1.fp}.json`;
    a.click();
  };

  const viewEinvoice = async (id: string) => {
    const payload = await api.get(`/api/gst/einvoice/${id}`);
    setEinv(JSON.stringify(payload, null, 2));
  };

  const input = "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8"><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">GST Compliance</h1>
        <p className="text-sm text-gray-500">GSTR-1 export &amp; e-invoice payloads</p></header>

      {/* GSTR-1 */}
      <section className="mb-8 rounded-xl border border-green-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">GSTR-1 (outward supplies)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={input}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${input} w-24`} />
          <button onClick={() => refetch()} className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-green-500">{isFetching ? "…" : "Refresh"}</button>
          <button onClick={download} disabled={!gstr1} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Download JSON</button>
        </div>
        {gstr1 && (
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600">
            <div>Period: <b>{gstr1.fp}</b></div>
            <div>B2B parties: <b>{gstr1.b2b.length}</b></div>
            <div>B2C summaries: <b>{gstr1.b2cs.length}</b></div>
            <div>Gross turnover: <b>₹{gstr1.gt.toLocaleString("en-IN")}</b></div>
          </div>
        )}
      </section>

      {/* e-invoice */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">E-invoice payload (NIC schema)</h2>
        <p className="mb-3 text-xs text-gray-500">Generates the IRP-ready JSON. Obtaining a live IRN + QR needs GSP credentials (deploy-time config).</p>
        <div className="flex flex-wrap gap-2">
          {invoices?.slice(0, 8).map((inv) => (
            <button key={inv.id} onClick={() => viewEinvoice(inv.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:border-green-500">
              {inv.number}
            </button>
          ))}
        </div>
        {einv && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-green-200">{einv}</pre>
        )}
      </section>
    </main>
  );
}
