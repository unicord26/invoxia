"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@invoixe/core";
import { api } from "../../lib/api";

type InvoiceRow = {
  id: string;
  number: string;
  date: string;
  partyName: string | null;
  grandTotal: number;
};

export default function InvoicesPage() {
  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<InvoiceRow[]>("/api/invoices"),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
          <h1 className="text-2xl font-extrabold text-gray-900">Sale Invoices</h1>
        </div>
        <Link
          href="/invoices/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          + New invoice
        </Link>
      </header>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {invoices?.length ?? 0} invoices
        </div>
        {isLoading && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {error && <p className="p-4 text-sm text-red-600">Failed to load: {String(error)}</p>}
        {invoices?.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">
            No invoices yet. <Link href="/invoices/new" className="text-green-700 underline">Create one</Link>.
          </p>
        )}
        <ul className="divide-y divide-gray-100">
          {invoices?.map((inv) => (
            <li key={inv.id}>
              <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">{inv.number}</div>
                  <div className="text-xs text-gray-500">
                    {inv.partyName ?? "Cash sale"} · {new Date(inv.date).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div className="font-semibold text-green-700">{formatINR(inv.grandTotal)}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
