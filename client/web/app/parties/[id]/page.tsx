"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR, rupeesToPaise } from "@invoixe/core";
import { api } from "../../../lib/api";

type Entry = {
  id: string;
  type: string;
  number: string;
  date: string;
  debit: number;
  credit: number;
  balance: number;
  paymentMode: string | null;
  referenceNo: string | null;
};
type Ledger = {
  party: { id: string; name: string; type: string; gstin: string | null; phone: string | null };
  openingBalance: number;
  entries: Entry[];
  outstanding: number;
};

const MODES = ["cash", "upi", "bank_transfer", "cheque", "card"] as const;

const LABELS: Record<string, string> = {
  sale: "Sale invoice",
  payment_in: "Payment in",
  payment_out: "Payment out",
  credit_note: "Credit note",
  debit_note: "Debit note",
  purchase: "Purchase",
};

export default function PartyLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ledger", id],
    queryFn: () => api.get<Ledger>(`/api/parties/${id}/ledger`),
  });

  const [type, setType] = useState<"payment_in" | "payment_out">("payment_in");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("cash");
  const [ref, setRef] = useState("");

  const pay = useMutation({
    mutationFn: () =>
      api.post("/api/payments", {
        partyId: id,
        type,
        amount: rupeesToPaise(Number(amount)),
        paymentMode: mode,
        referenceNo: ref.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger", id] });
      setAmount("");
      setRef("");
    },
  });

  if (isLoading) return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  if (error || !data) return <p className="p-8 text-sm text-red-600">Party not found.</p>;

  const outstanding = data.outstanding;
  const receivable = outstanding > 0;
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <Link href="/parties" className="text-sm text-green-700 hover:underline">← Parties</Link>
        <div className="mt-1 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{data.party.name}</h1>
            <p className="text-sm capitalize text-gray-500">
              {data.party.type}
              {data.party.gstin ? ` · ${data.party.gstin}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              {outstanding === 0 ? "Settled" : receivable ? "Receivable" : "Payable"}
            </div>
            <div className={`text-2xl font-extrabold ${outstanding === 0 ? "text-gray-700" : receivable ? "text-green-600" : "text-red-500"}`}>
              {formatINR(Math.abs(outstanding))}
            </div>
            {receivable && data.party.phone && (
              <button
                onClick={() => {
                  const msg = `Hi ${data.party.name}, a gentle reminder that ${formatINR(Math.abs(outstanding))} is outstanding on your account. Kindly clear at your earliest. Thank you!`;
                  window.open(`https://wa.me/91${data.party.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="mt-1 rounded-lg border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
              >
                WhatsApp reminder
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Record payment */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(amount) > 0) pay.mutate();
        }}
        className="mb-8 grid gap-3 rounded-xl border border-green-200 bg-white p-4 sm:grid-cols-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={input}>
            <option value="payment_in">Payment in</option>
            <option value="payment_out">Payment out</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Amount (₹)</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`${input} capitalize`}>
            {MODES.map((m) => (
              <option key={m} value={m}>{m.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Reference</label>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Cheque/UTR" className={input} />
        </div>
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={pay.isPending || !(Number(amount) > 0)}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {pay.isPending ? "Recording…" : "Record payment"}
          </button>
          {pay.error && <span className="ml-3 text-sm text-red-600">{String(pay.error.message)}</span>}
        </div>
      </form>

      {/* Ledger */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Ledger
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Particulars</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Credit</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="text-gray-500">
                <td className="px-4 py-2" colSpan={4}>Opening balance</td>
                <td className="px-4 py-2 text-right">{formatINR(data.openingBalance)}</td>
              </tr>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-gray-500">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2">
                    <span className="text-gray-900">{LABELS[e.type] ?? e.type}</span>{" "}
                    <span className="text-xs text-gray-400">{e.number}</span>
                    {e.paymentMode && <span className="ml-1 text-xs capitalize text-gray-400">· {e.paymentMode.replace("_", " ")}</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{e.debit ? formatINR(e.debit) : "—"}</td>
                  <td className="px-4 py-2 text-right text-green-600">{e.credit ? formatINR(e.credit) : "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatINR(e.balance)}</td>
                </tr>
              ))}
              {data.entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
