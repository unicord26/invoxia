"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  ShoppingCart,
  Wallet,
  Printer,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from "lucide-react";
import { formatINR } from "@invoixe/core";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page-header";
import { DataExportModal } from "../../components/data-export-modal";
import { ReportPrintModal, type ReportPrintData } from "../../components/report-print-modal";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type Summary = {
  sales: number;        // paise
  purchases: number;    // paise
  expenses: number;     // paise
  outputTax: number;    // paise
  inputTax: number;     // paise
  grossProfit: number;  // paise
  receivables: number;  // paise
  payables: number;     // paise
};

type TxRow = {
  id: string;
  type: string;
  number: string;
  date: string;
  dueDate?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  paymentMode?: string | null;
  referenceNo?: string | null;
  category?: string | null;
  subTotal?: number;
  totalTax?: number;
  grandTotal: number; // paise
};

type TrendPoint = {
  label: string;
  sales: number;      // paise
  purchases?: number; // paise
  expenses: number;   // paise
  profit?: number;    // paise
};

const RANGES = [
  { label: "Today", value: "1D" },
  { label: "7 Days", value: "7D" },
  { label: "This Month", value: "1M" },
  { label: "This Year", value: "1Y" },
  { label: "5 Years", value: "5Y" },
  { label: "All Time", value: "All" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Custom Interactive Bar Chart Component ───────────────────────────────────
function InteractiveTrendBars({
  points,
  field,
  title,
  color,
}: {
  points: TrendPoint[];
  field: "sales" | "purchases" | "expenses";
  title: string;
  color: "green" | "blue" | "red" | "purple";
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const values = useMemo(() => points.map((p) => (p[field] as number) ?? 0), [points, field]);
  const maxVal = useMemo(() => Math.max(...values, 1), [values]);
  const totalVal = useMemo(() => values.reduce((s, v) => s + v, 0), [values]);

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const activeValue = activePoint ? (activePoint[field] as number) ?? 0 : null;

  const theme = {
    green: { bar: "bg-emerald-500 hover:bg-emerald-400", badge: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300" },
    blue: { bar: "bg-blue-500 hover:bg-blue-400", badge: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300" },
    red: { bar: "bg-rose-500 hover:bg-rose-400", badge: "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300" },
    purple: { bar: "bg-purple-500 hover:bg-purple-400", badge: "text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300" },
  }[color];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {title}
          </p>
          <p className="text-[10px] text-zinc-400">
            Periodic breakdown (Total: <strong className="text-zinc-800 dark:text-zinc-200">{formatINR(totalVal)}</strong>)
          </p>
        </div>
        {activePoint && activeValue !== null && (
          <div className={cn("px-2.5 py-1 rounded text-xs font-bold border transition-all", theme.badge)}>
            {activePoint.label}: {formatINR(activeValue)}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1.5 h-28 w-full pt-2">
        {points.map((p, i) => {
          const val = (p[field] as number) ?? 0;
          const pct = (val / maxVal) * 100;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="flex-1 flex flex-col items-center gap-1 group cursor-pointer relative"
            >
              <div
                title={`${p.label}: ${formatINR(val)}`}
                className={cn(
                  "w-full rounded-t transition-all",
                  theme.bar,
                  isHovered && "ring-2 ring-zinc-400 dark:ring-zinc-500"
                )}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
              <span className="text-[9px] font-medium text-zinc-400 truncate w-full text-center">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Profitability Trend Chart ────────────────────────────────────────────────
function ProfitabilityTrendChart({ points }: { points: TrendPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const processed = useMemo(() => {
    return points.map((p) => {
      const sales = p.sales ?? 0;
      const outflows = (p.purchases ?? 0) + (p.expenses ?? 0);
      const profit = p.profit !== undefined ? p.profit : sales - outflows;
      return { label: p.label, sales, outflows, profit };
    });
  }, [points]);

  const maxVal = useMemo(() => {
    const vals = processed.map((p) => Math.abs(p.profit));
    return Math.max(...vals, 1);
  }, [processed]);

  const activePoint = hoveredIdx !== null ? processed[hoveredIdx] : null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Profitability Trend
          </p>
          <p className="text-[10px] text-zinc-400">
            Net profit / loss per interval (Revenue − Purchases & Expenses)
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Net Profit
          </span>
          <span className="inline-flex items-center gap-1 text-rose-500">
            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Net Loss
          </span>
        </div>
      </div>

      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs">
          <span className="font-bold text-zinc-800 dark:text-zinc-100">{activePoint.label}</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-zinc-600 dark:text-zinc-400">
              Sales: <strong className="text-emerald-600">{formatINR(activePoint.sales)}</strong>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              Outflows: <strong className="text-zinc-800 dark:text-zinc-200">{formatINR(activePoint.outflows)}</strong>
            </span>
            <span className="font-bold">
              Net Profit:{" "}
              <strong className={activePoint.profit >= 0 ? "text-emerald-600" : "text-rose-500"}>
                {activePoint.profit >= 0 ? `+${formatINR(activePoint.profit)}` : formatINR(activePoint.profit)}
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5 h-28 w-full pt-2">
        {processed.map((p, i) => {
          const isProf = p.profit >= 0;
          const pct = (Math.abs(p.profit) / maxVal) * 100;
          const height = Math.max(pct, 4);

          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="flex-1 flex flex-col items-center gap-1 group cursor-pointer relative"
            >
              <div
                title={`${p.label}: Net ${isProf ? "Profit" : "Loss"} ${formatINR(p.profit)}`}
                className={cn(
                  "w-full rounded-t transition-all",
                  isProf
                    ? "bg-emerald-500 group-hover:bg-emerald-400"
                    : "bg-rose-500 group-hover:bg-rose-400"
                )}
                style={{ height: `${height}%` }}
              />
              <span className="text-[9px] font-medium text-zinc-400 truncate w-full text-center">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main P&L Report Component ────────────────────────────────────────────────
export function PnlReport() {
  const [range, setRange] = useState("1M");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sales: true,
    purchases: true,
    expenses: true,
    profit: true,
  });

  // Data Export Modal state
  const [exportModal, setExportModal] = useState<{
    open: boolean;
    title: string;
    filenamePrefix: string;
    rows: string[][];
  }>({ open: false, title: "", filenamePrefix: "", rows: [] });

  // PDF Print Modal state
  const [printModalData, setPrintModalData] = useState<ReportPrintData | null>(null);

  // Queries
  const { data: summary, refetch: refetchSum } = useQuery({
    queryKey: ["reports", "summary", range],
    queryFn: () => api.get<Summary>(`/api/reports/summary?range=${range}`),
  });

  const { data: trendData = [], refetch: refetchTrend } = useQuery({
    queryKey: ["reports", "trend", range],
    queryFn: () => api.get<TrendPoint[]>(`/api/reports/trend?range=${range}`),
  });

  const { data: txList = [], refetch: refetchTx } = useQuery({
    queryKey: ["reports", "daybook", range],
    queryFn: () => api.get<TxRow[]>(`/api/reports/daybook?range=${range}`),
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Filter transactions into Sales, Purchases, Expenses
  const salesTxs = useMemo(() => txList.filter((t) => t.type === "sale_invoice" || t.type === "pos_invoice"), [txList]);
  const purchaseTxs = useMemo(() => txList.filter((t) => t.type === "purchase_bill"), [txList]);
  const expenseTxs = useMemo(() => txList.filter((t) => t.type === "expense"), [txList]);

  // Calculated totals
  const totalSales = summary?.sales ?? 0;
  const totalPurchases = summary?.purchases ?? 0;
  const totalExpenses = summary?.expenses ?? 0;
  const grossProfit = summary?.grossProfit ?? totalSales - totalPurchases;
  const netProfit = totalSales - totalPurchases - totalExpenses;
  const profitMarginPct = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : "0.0";

  // Search query state for itemized tables
  const [salesSearch, setSalesSearch] = useState("");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");

  const filteredSales = useMemo(() => {
    if (!salesSearch.trim()) return salesTxs;
    const q = salesSearch.toLowerCase();
    return salesTxs.filter((t) => t.number.toLowerCase().includes(q) || (t.partyName && t.partyName.toLowerCase().includes(q)));
  }, [salesTxs, salesSearch]);

  const filteredPurchases = useMemo(() => {
    if (!purchaseSearch.trim()) return purchaseTxs;
    const q = purchaseSearch.toLowerCase();
    return purchaseTxs.filter((t) => t.number.toLowerCase().includes(q) || (t.partyName && t.partyName.toLowerCase().includes(q)));
  }, [purchaseTxs, purchaseSearch]);

  const filteredExpenses = useMemo(() => {
    if (!expenseSearch.trim()) return expenseTxs;
    const q = expenseSearch.toLowerCase();
    return expenseTxs.filter((t) => (t.category && t.category.toLowerCase().includes(q)) || (t.referenceNo && t.referenceNo.toLowerCase().includes(q)));
  }, [expenseTxs, expenseSearch]);

  const handleRefresh = () => {
    refetchSum();
    refetchTrend();
    refetchTx();
  };

  const triggerExportModal = (title: string, filenamePrefix: string, rows: string[][]) => {
    setExportModal({ open: true, title, filenamePrefix, rows });
  };

  const handleOpenPdfReport = () => {
    setPrintModalData({
      reportType: "pnl",
      title: "Profit & Loss Audit Statement",
      periodLabel: RANGES.find((r) => r.value === range)?.label ?? range,
      summary: {
        totalSales,
        totalPurchases,
        totalExpenses,
        grossProfit,
        netProfit,
        profitMarginPct,
      },
      tables: {
        sales: salesTxs,
        purchases: purchaseTxs,
        expenses: expenseTxs,
      },
    });
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="Profit & Loss Statement"
        description="Comprehensive analysis of sales revenue, purchases, operating expenses, and net profit margins."
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 shadow-inner dark:border-zinc-800 dark:bg-zinc-900">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  range === r.value
                    ? "bg-white text-zinc-900 shadow-xs border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <button
            onClick={handleOpenPdfReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print P&L
          </button>
        </div>
      </PageHeader>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-zinc-900 dark:border-emerald-900/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Sales Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-2 font-mono">
            {formatINR(totalSales)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-emerald-600 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{salesTxs.length} Sales Documents</span>
          </div>
        </div>

        {/* Total Purchases */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-zinc-900 dark:border-blue-900/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Total Purchases</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-2 font-mono">
            {formatINR(totalPurchases)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-blue-600 font-semibold">
            <span>{purchaseTxs.length} Vendor Bills</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/20 dark:to-zinc-900 dark:border-rose-900/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Operating Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-2 font-mono">
            {formatINR(totalExpenses)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-rose-600 font-semibold">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>{expenseTxs.length} Operating Expenses</span>
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-zinc-900 dark:border-purple-900/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Net Profit Margin</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <p className={cn("text-2xl font-black mt-2 font-mono", netProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {formatINR(netProfit)}
          </p>
          <div className="flex items-center justify-between mt-2 text-[11px] font-semibold text-zinc-500">
            <span>Profit Margin:</span>
            <span className={cn("px-2 py-0.5 rounded font-extrabold", netProfit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
              {profitMarginPct}%
            </span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          Category 1: Total Sales Report
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("sales")}
          className="w-full px-6 py-4 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 transition hover:bg-zinc-100/60"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">1. Total Sales Report</h2>
              <p className="text-xs text-zinc-500">Gross revenue, invoice breakdowns, and sale trends</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-emerald-600 font-mono">{formatINR(totalSales)}</span>
            {openSections.sales ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
          </div>
        </button>

        {openSections.sales && (
          <div className="p-6 space-y-6 animate-in fade-in duration-150">
            <InteractiveTrendBars points={trendData} field="sales" title="Sales Revenue Trend" color="green" />

            {/* Sales Table Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-emerald-500 transition"
                />
              </div>

              <button
                onClick={() =>
                  triggerExportModal(
                    "Export Sales Report",
                    `Sales_Report_${range}`,
                    [
                      ["Invoice No", "Date", "Customer Name", "Payment Mode", "Grand Total (INR)"],
                      ...filteredSales.map((s) => [s.number, fmtDate(s.date), s.partyName || "Cash Sale", s.paymentMode || "Cash", formatINR(s.grandTotal)]),
                    ]
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Export Sales Data
              </button>
            </div>

            {/* Sales Table */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                  {filteredSales.slice(0, 15).map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition">
                      <td className="py-2.5 px-4 font-bold font-mono text-zinc-900 dark:text-zinc-100">{s.number}</td>
                      <td className="py-2.5 px-4 text-zinc-500">{fmtDate(s.date)}</td>
                      <td className="py-2.5 px-4 font-semibold">{s.partyName || "Cash Sale"}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          {s.paymentMode || "Cash"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold font-mono text-emerald-600">{formatINR(s.grandTotal)}</td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-zinc-400">No sales transactions found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          Category 2: Purchases Report
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("purchases")}
          className="w-full px-6 py-4 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 transition hover:bg-zinc-100/60"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">2. Purchases Report</h2>
              <p className="text-xs text-zinc-500">Supplier procurement, vendor bills, and material orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-blue-600 font-mono">{formatINR(totalPurchases)}</span>
            {openSections.purchases ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
          </div>
        </button>

        {openSections.purchases && (
          <div className="p-6 space-y-6 animate-in fade-in duration-150">
            <InteractiveTrendBars points={trendData} field="purchases" title="Purchases Expenditure Trend" color="blue" />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search bill or supplier..."
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-blue-500 transition"
                />
              </div>

              <button
                onClick={() =>
                  triggerExportModal(
                    "Export Purchases Report",
                    `Purchases_Report_${range}`,
                    [
                      ["Bill No", "Date", "Supplier Name", "Payment Mode", "Grand Total (INR)"],
                      ...filteredPurchases.map((p) => [p.number, fmtDate(p.date), p.partyName || "Direct Purchase", p.paymentMode || "Bank", formatINR(p.grandTotal)]),
                    ]
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Export Purchases Data
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                  {filteredPurchases.slice(0, 15).map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition">
                      <td className="py-2.5 px-4 font-bold font-mono text-zinc-900 dark:text-zinc-100">{p.number}</td>
                      <td className="py-2.5 px-4 text-zinc-500">{fmtDate(p.date)}</td>
                      <td className="py-2.5 px-4 font-semibold">{p.partyName || "Direct Purchase"}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          {p.paymentMode || "Bank"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold font-mono text-blue-600">{formatINR(p.grandTotal)}</td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-zinc-400">No purchase records found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          Category 3: Expenses Report
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("expenses")}
          className="w-full px-6 py-4 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 transition hover:bg-zinc-100/60"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">3. Expenses Report</h2>
              <p className="text-xs text-zinc-500">Operating overheads, utilities, logistics, and admin expenses</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-rose-600 font-mono">{formatINR(totalExpenses)}</span>
            {openSections.expenses ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
          </div>
        </button>

        {openSections.expenses && (
          <div className="p-6 space-y-6 animate-in fade-in duration-150">
            <InteractiveTrendBars points={trendData} field="expenses" title="Operating Expenses Breakdown" color="red" />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search category or reference..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-rose-500 transition"
                />
              </div>

              <button
                onClick={() =>
                  triggerExportModal(
                    "Export Expenses Report",
                    `Expenses_Report_${range}`,
                    [
                      ["Expense Ref #", "Date", "Category", "Payment Mode", "Grand Total (INR)"],
                      ...filteredExpenses.map((e) => [e.number || e.referenceNo || "-", fmtDate(e.date), e.category || "General", e.paymentMode || "Cash", formatINR(e.grandTotal)]),
                    ]
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                <Download className="w-3.5 h-3.5 text-rose-600" />
                Export Expenses Data
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ref #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Expense Category</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                  {filteredExpenses.slice(0, 15).map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition">
                      <td className="py-2.5 px-4 font-bold font-mono text-zinc-900 dark:text-zinc-100">{e.number || e.referenceNo || "-"}</td>
                      <td className="py-2.5 px-4 text-zinc-500">{fmtDate(e.date)}</td>
                      <td className="py-2.5 px-4 font-semibold">{e.category || "General Overhead"}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                          {e.paymentMode || "Cash"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold font-mono text-rose-600">{formatINR(e.grandTotal)}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-zinc-400">No expense records found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          Category 4: Gross Profit & Margin Report
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden shadow-xs">
        <button
          onClick={() => toggleSection("profit")}
          className="w-full px-6 py-4 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 transition hover:bg-zinc-100/60"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">4. Gross Profit & Margin Report</h2>
              <p className="text-xs text-zinc-500">Gross profit, operating margins, and periodic profitability ratios</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-sm font-extrabold font-mono", netProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatINR(netProfit)} ({profitMarginPct}%)
            </span>
            {openSections.profit ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
          </div>
        </button>

        {openSections.profit && (
          <div className="p-6 space-y-6 animate-in fade-in duration-150">
            <ProfitabilityTrendChart points={trendData} />

            {/* Profit Margin Summary Ledger Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Gross Trading Profit</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">{formatINR(grossProfit)}</p>
                <p className="text-[10px] text-zinc-400 mt-1">Sales Revenue − Direct Material Purchases</p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Operating Expenses</p>
                <p className="text-lg font-bold text-rose-600 mt-1 font-mono">− {formatINR(totalExpenses)}</p>
                <p className="text-[10px] text-zinc-400 mt-1">Total operational overheads</p>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 bg-emerald-50/30 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Net Profit Margin</p>
                <p className="text-lg font-extrabold text-emerald-600 mt-1 font-mono">{formatINR(netProfit)}</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">Net Margin Ratio: <strong>{profitMarginPct}%</strong></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Format Data Export Modal */}
      <DataExportModal
        open={exportModal.open}
        onOpenChange={(op) => setExportModal((prev) => ({ ...prev, open: op }))}
        title={exportModal.title}
        filenamePrefix={exportModal.filenamePrefix}
        rows={exportModal.rows}
      />

      {/* Statutory Corporate Audit PDF Report Modal */}
      <ReportPrintModal
        open={!!printModalData}
        onOpenChange={(op) => {
          if (!op) setPrintModalData(null);
        }}
        data={printModalData}
      />
    </div>
  );
}

export default PnlReport;
