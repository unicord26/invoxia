"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR, rupeesToPaise } from "@invoixe/core";
import { GST_RATES } from "@invoixe/types";
import { api } from "../../lib/api";

type Row = { id: string; number: string; date: string; category: string | null; paymentMode: string | null; grandTotal: number };
const CATEGORIES = ["Rent", "Salary", "Electricity", "Transport", "Office", "Marketing", "Misc"];

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: () => api.get<Row[]>("/api/expenses") });
  const [category, setCategory] = useState("Rent");
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState("0");

  const add = useMutation({
    mutationFn: () => api.post("/api/expenses", { category, amount: rupeesToPaise(Number(amount)), taxRate: Number(taxRate) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setAmount(""); },
  });
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8"><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">Expenses</h1></header>

      <form onSubmit={(e) => { e.preventDefault(); if (Number(amount) > 0) add.mutate(); }} className="mb-8 grid gap-3 rounded-xl border border-green-200 bg-white p-4 sm:grid-cols-4">
        <div><label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-medium text-gray-600">Amount (₹)</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={input} /></div>
        <div><label className="mb-1 block text-xs font-medium text-gray-600">GST</label>
          <select value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={input}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
        <div className="flex items-end"><button type="submit" disabled={add.isPending || !(Number(amount) > 0)} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Add</button></div>
      </form>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{data?.length ?? 0} expenses</div>
        {isLoading && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {data?.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No expenses yet.</p>}
        <ul className="divide-y divide-gray-100">
          {data?.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3">
              <div><div className="font-medium text-gray-900">{r.category ?? "Expense"}</div>
                <div className="text-xs text-gray-500">{r.number} · {new Date(r.date).toLocaleDateString("en-IN")}</div></div>
              <div className="font-semibold text-red-500">{formatINR(r.grandTotal)}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
