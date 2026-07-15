"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@invoixe/core";
import { api } from "../../lib/api";

type Row = { id: string; number: string; date: string; partyName: string | null; referenceNo: string | null; grandTotal: number };

export default function PurchasesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["purchases"], queryFn: () => api.get<Row[]>("/api/purchases") });
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
          <h1 className="text-2xl font-extrabold text-gray-900">Purchases</h1></div>
        <Link href="/purchases/new" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">+ New purchase</Link>
      </header>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{data?.length ?? 0} purchase bills</div>
        {isLoading && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {data?.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No purchases yet.</p>}
        <ul className="divide-y divide-gray-100">
          {data?.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3">
              <div><div className="font-medium text-gray-900">{r.number}{r.referenceNo ? ` · ${r.referenceNo}` : ""}</div>
                <div className="text-xs text-gray-500">{r.partyName ?? "—"} · {new Date(r.date).toLocaleDateString("en-IN")}</div></div>
              <div className="font-semibold text-red-500">{formatINR(r.grandTotal)}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
