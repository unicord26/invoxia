"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { computeInvoice, formatINR, rupeesToPaise, inWordsINR } from "@invoixe/core";
import { GST_RATES, type DocumentType, type Item, type Party } from "@invoixe/types";
import { api } from "../../lib/api";
import {
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  Search,
  CheckCircle2,
  Calendar,
  User,
  ArrowRightLeft,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const TABS: {
  type: DocumentType;
  label: string;
  badge: string;
  supplier: boolean;
  convertible: boolean;
}[] = [
  { type: "estimate", label: "Estimates", badge: "Quote", supplier: false, convertible: true },
  { type: "proforma", label: "Proforma Invoices", badge: "PI", supplier: false, convertible: true },
  { type: "sale_order", label: "Sale Orders", badge: "SO", supplier: false, convertible: true },
  { type: "purchase_order", label: "Purchase Orders", badge: "PO", supplier: true, convertible: false },
  { type: "delivery_challan", label: "Delivery Challans", badge: "DC", supplier: false, convertible: false },
  { type: "credit_note", label: "Credit Notes", badge: "CN", supplier: false, convertible: false },
  { type: "debit_note", label: "Debit Notes", badge: "DN", supplier: true, convertible: false },
];

type Doc = {
  id: string;
  number: string;
  date: string;
  partyName: string | null;
  grandTotal: number;
  convertedToId: string | null;
};

type Line = {
  itemId: string | null;
  description: string;
  hsnSac: string;
  qty: string;
  rateRupees: string;
  taxRate: number;
};

const blankLine: Line = {
  itemId: null,
  description: "",
  hsnSac: "",
  qty: "1",
  rateRupees: "",
  taxRate: 18,
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const router = useRouter();

  // Tab State
  const [tab, setTab] = useState<DocumentType>("estimate");
  const cfg = useMemo(() => TABS.find((t) => t.type === tab)!, [tab]);

  // Form Collapse State
  const [showBuilder, setShowBuilder] = useState(false);

  // Form State
  const [partyId, setPartyId] = useState("");
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0] || ""
  );
  const [lines, setLines] = useState<Line[]>([{ ...blankLine }]);
  const [searchDocQuery, setSearchDocQuery] = useState("");

  // Queries
  const { data: parties } = useQuery({
    queryKey: ["parties"],
    queryFn: () => api.get<Party[]>("/api/parties"),
  });
  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.get<Item[]>("/api/items"),
  });
  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", tab],
    queryFn: () => api.get<Doc[]>(`/api/documents?type=${tab}`),
  });

  // Filter party pool based on document type
  const partyPool = useMemo(() => {
    return (parties ?? []).filter((p) =>
      cfg.supplier ? p.type !== "customer" : p.type !== "supplier"
    );
  }, [parties, cfg.supplier]);

  const selectedParty = parties?.find((p) => p.id === partyId);

  // Computed Invoice Total
  const invoiceData = useMemo(() => {
    const validLines = lines
      .filter((l) => Number(l.qty) > 0 && l.rateRupees !== "")
      .map((l) => ({
        qty: Number(l.qty),
        rate: rupeesToPaise(Number(l.rateRupees)),
        taxRate: l.taxRate,
      }));

    if (!validLines.length) return { grandTotal: 0, subTotal: 0, totalTax: 0 };

    const computed = computeInvoice({
      sellerStateCode: "27",
      buyerStateCode: "27",
      lines: validLines,
    });

    return {
      grandTotal: computed.totals.grandTotal,
      subTotal: computed.totals.subTotal,
      totalTax: computed.totals.totalTax,
    };
  }, [lines]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      api.post("/api/documents", {
        type: tab,
        partyId: partyId || null,
        date: docDate,
        dueDate: dueDate || null,
        lines: lines
          .filter((l) => Number(l.qty) > 0 && l.rateRupees !== "" && l.description.trim())
          .map((l) => ({
            itemId: l.itemId,
            description: l.description.trim(),
            hsnSac: l.hsnSac || null,
            qty: Number(l.qty),
            rate: rupeesToPaise(Number(l.rateRupees)),
            taxRate: l.taxRate,
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", tab] });
      setLines([{ ...blankLine }]);
      setPartyId("");
      setShowBuilder(false);
      toast.success(`${cfg.label} saved`);
    },
    onError: () => toast.error(`Could not save ${cfg.label}`),
  });

  // Convert Mutation
  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/api/documents/${id}/convert`, {}),
    onSuccess: (inv) => {
      toast.success("Converted to Sales Invoice");
      router.push(`/invoices/${inv.id}`);
    },
    onError: () => toast.error("Could not convert document"),
  });

  // Handlers
  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const pickItem = (idx: number, itemId: string) => {
    const selectedItem = items?.find((x) => x.id === itemId);
    if (!selectedItem) {
      updateLine(idx, { itemId: null });
      return;
    }
    updateLine(idx, {
      itemId: selectedItem.id,
      description: selectedItem.name,
      hsnSac: selectedItem.hsnSac || "",
      rateRupees: (selectedItem.salePrice / 100).toString(),
      taxRate: selectedItem.taxRate,
    });
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const filteredDocs = useMemo(() => {
    return (docs ?? []).filter(
      (d) =>
        d.number.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
        (d.partyName && d.partyName.toLowerCase().includes(searchDocQuery.toLowerCase()))
    );
  }, [docs, searchDocQuery]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50/50">
      {/* ── Full Width Container with Clean Edge Padding ── */}
      <div className="w-full px-6 sm:px-8 py-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Estimates & Orders</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Quotations, proformas, orders, and delivery challans</p>
            </div>
          </div>

          <button
            onClick={() => setShowBuilder((v) => !v)}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {showBuilder ? "Hide Form" : `New ${cfg.label.slice(0, -1)}`}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200/60 pb-3">
          {TABS.map((t) => {
            const active = tab === t.type;
            return (
              <button
                key={t.type}
                onClick={() => {
                  setTab(t.type);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Document Creation Form (Collapsible / Clean) ── */}
        {showBuilder && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-900">Create New {cfg.label.slice(0, -1)}</h3>
              <button
                onClick={() => setShowBuilder(false)}
                className="text-xs font-semibold text-zinc-400 hover:text-zinc-600"
              >
                Cancel
              </button>
            </div>

            {/* Header Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">
                  {cfg.supplier ? "Supplier" : "Customer"}
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-600 focus:bg-white"
                >
                  <option value="">— Select {cfg.supplier ? "Supplier" : "Customer"} —</option>
                  {partyPool.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Document Date</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Valid Until / Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Line Items</div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 w-56">Item</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 w-20 text-center">Qty</th>
                      <th className="px-4 py-3 w-28 text-right">Rate (₹)</th>
                      <th className="px-4 py-3 w-24 text-center">GST %</th>
                      <th className="px-4 py-3 w-32 text-right">Total (₹)</th>
                      <th className="px-3 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                    {lines.map((l, i) => {
                      const rowQty = Number(l.qty) || 0;
                      const rowRate = Number(l.rateRupees) || 0;
                      const lineTotalRupees = rowQty * rowRate * (1 + l.taxRate / 100);

                      return (
                        <tr key={i} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-2.5">
                            <select
                              value={l.itemId ?? ""}
                              onChange={(e) => pickItem(i, e.target.value)}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-600"
                            >
                              <option value="">— Select —</option>
                              {items?.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              value={l.description}
                              onChange={(e) => updateLine(i, { description: e.target.value })}
                              placeholder="Item description..."
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              step="any"
                              value={l.qty}
                              onChange={(e) => updateLine(i, { qty: e.target.value })}
                              className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-center font-bold outline-none focus:border-emerald-600"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              step="0.01"
                              value={l.rateRupees}
                              onChange={(e) => updateLine(i, { rateRupees: e.target.value })}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-right font-bold outline-none focus:border-emerald-600"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={l.taxRate}
                              onChange={(e) => updateLine(i, { taxRate: Number(e.target.value) })}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-center font-semibold outline-none focus:border-emerald-600"
                            >
                              {GST_RATES.map((r) => (
                                <option key={r} value={r}>
                                  {r}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-right font-extrabold text-zinc-900">
                            {formatINR(rupeesToPaise(lineTotalRupees))}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {lines.length > 1 && (
                              <button
                                onClick={() => removeLine(i)}
                                className="text-zinc-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Footer */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-100 pt-4">
              <button
                onClick={() => setLines((p) => [...p, { ...blankLine }])}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>

              <div className="flex flex-col items-end gap-2">
                <div className="text-xs text-zinc-500 space-x-3">
                  <span>Subtotal: {formatINR(invoiceData.subTotal)}</span>
                  <span>GST: {formatINR(invoiceData.totalTax)}</span>
                  <span>
                    Total: <b className="text-base font-extrabold text-zinc-900">{formatINR(invoiceData.grandTotal)}</b>
                  </span>
                </div>

                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || invoiceData.grandTotal === 0}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving..." : `Save ${cfg.label.slice(0, -1)}`}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Document Directory List Table ── */}
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 px-6 py-4">
            <div className="font-bold text-sm text-zinc-900 flex items-center gap-2">
              <span>{cfg.label}</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 font-semibold">
                {filteredDocs.length}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchDocQuery}
                onChange={(e) => setSearchDocQuery(e.target.value)}
                placeholder="Search by number or party..."
                className="w-full rounded-xl border border-zinc-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/60 font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Number</th>
                  <th className="px-6 py-3.5">Party Name</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Grand Total</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                {docsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="h-12 bg-zinc-50/30" />
                    </tr>
                  ))
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400">
                      No {cfg.label.toLowerCase()} found. Click "+ New" above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-6 py-4 font-bold text-zinc-900">{d.number}</td>
                      <td className="px-6 py-4 font-semibold text-zinc-800">
                        {d.partyName || "Walk-in Customer"}
                      </td>
                      <td className="px-6 py-4 text-zinc-500">
                        {new Date(d.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-zinc-900">
                        {formatINR(d.grandTotal)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {d.convertedToId ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                            Converted
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {cfg.convertible && (
                          d.convertedToId ? (
                            <Link
                              href={`/invoices/${d.convertedToId}`}
                              className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                            >
                              View Invoice <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <button
                              onClick={() => convertMutation.mutate(d.id)}
                              disabled={convertMutation.isPending}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition disabled:opacity-50"
                            >
                              Convert to Invoice
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
