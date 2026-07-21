"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  TrendingUp,
  ShoppingCart,
  Wallet,
  Receipt,
  Package,
  Download,
  Printer,
  RefreshCw,
  Search,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  Calendar,
  Building2,
  PieChart,
  BarChart3,
  Layers,
} from "lucide-react";
import { formatINR } from "@invoixe/core";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page-header";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Data Types (matching API response)
// ──────────────────────────────────────────────────────────────────────────────

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

type Gst = {
  output: { taxable: number; cgst: number; sgst: number; igst: number; total: number };
  input: { cgst: number; sgst: number; igst: number; total: number };
  netPayable: number;
};

type Outstanding = {
  id: string;
  name: string;
  type: string;
  phone?: string | null;
  balance: number; // paise
};

type StockRow = {
  id: string;
  name: string;
  itemCode?: string | null;
  categoryName?: string;
  unit: string;
  qty: number;
  minStock: number;
  purchasePrice: number; // paise
  salePrice: number;     // paise
  value: number;         // paise
  low: boolean;
};

type Stock = { rows: StockRow[]; totalValue: number };

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
  profit?: number;    // paise (sales - purchases - expenses)
};

const RANGES = [
  { label: "Today", value: "1D" },
  { label: "7 Days", value: "7D" },
  { label: "This Month", value: "1M" },
  { label: "This Year", value: "1Y" },
  { label: "5 Years", value: "5Y" },
  { label: "All Time", value: "All" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function usePersistentOpen(key: string, defaultValue: boolean) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return defaultValue;
    const stored = localStorage.getItem(key);
    return stored !== null ? stored === "true" : defaultValue;
  });
  const toggle = useCallback(
    (val: boolean) => {
      setOpen(val);
      localStorage.setItem(key, String(val));
    },
    [key]
  );
  return [open, toggle] as const;
}

// ──────────────────────────────────────────────────────────────────────────────
// UI Atoms
// ──────────────────────────────────────────────────────────────────────────────

function KpiBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white dark:bg-zinc-950 p-4 border-zinc-200 dark:border-zinc-800 shadow-xs",
        accent
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </p>
      <p className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-400">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Interactive Real-Time Chart Components
// ──────────────────────────────────────────────────────────────────────────────

/** Interactive Trend Bar Chart for Sales, Purchases, and Expenses */
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
    green: {
      bar: "bg-green-500 hover:bg-green-400",
      badge: "text-green-600 bg-green-50 dark:bg-green-950/30",
      border: "border-green-200 dark:border-green-900",
    },
    blue: {
      bar: "bg-blue-500 hover:bg-blue-400",
      badge: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-900",
    },
    red: {
      bar: "bg-red-400 hover:bg-red-300",
      badge: "text-red-600 bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-900",
    },
    purple: {
      bar: "bg-purple-500 hover:bg-purple-400",
      badge: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
      border: "border-purple-200 dark:border-purple-900",
    },
  }[color];

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {title}
          </p>
          <p className="text-[10px] text-zinc-400">
            Real-time periodic breakdown (Total: {formatINR(totalVal)})
          </p>
        </div>
        {activePoint && activeValue !== null && (
          <div className={cn("px-2.5 py-1 rounded text-xs font-bold border animate-in fade-in duration-100", theme.badge, theme.border)}>
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
                  isHovered && "ring-2 ring-zinc-400 dark:ring-zinc-600"
                )}
                style={{ height: `${Math.max(pct, 3)}%` }}
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

/** Bi-directional Profitability Trend Chart */
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
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Monthly Profitability Trend
          </p>
          <p className="text-[10px] text-zinc-400">
            Real-time net profit / loss per interval (Revenue − Purchases & Expenses)
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-medium">
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Net Profit
          </span>
          <span className="inline-flex items-center gap-1 text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Net Loss
          </span>
        </div>
      </div>

      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs animate-in fade-in duration-100">
          <span className="font-bold text-zinc-800 dark:text-zinc-100">{activePoint.label}</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-zinc-600 dark:text-zinc-400">
              Sales: <strong className="text-green-600">{formatINR(activePoint.sales)}</strong>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              Outflows: <strong className="text-zinc-800 dark:text-zinc-200">{formatINR(activePoint.outflows)}</strong>
            </span>
            <span className="font-bold">
              Profit:{" "}
              <strong className={activePoint.profit >= 0 ? "text-green-600" : "text-red-500"}>
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
                    ? "bg-green-500 group-hover:bg-green-400"
                    : "bg-red-500 group-hover:bg-red-400"
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

/** Receivables / Payables Distribution Chart */
function DebtDistributionChart({
  items,
  title,
  subtitle,
  valueColor,
}: {
  items: Outstanding[];
  title: string;
  subtitle: string;
  valueColor: "green" | "red";
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const brackets = useMemo(() => {
    const list = items.map((i) => ({ ...i, absBal: Math.abs(i.balance) }));

    const b1 = list.filter((i) => i.absBal <= 1000000); // <= ₹10,000
    const b2 = list.filter((i) => i.absBal > 1000000 && i.absBal <= 5000000); // ₹10k - ₹50k
    const b3 = list.filter((i) => i.absBal > 5000000 && i.absBal <= 10000000); // ₹50k - ₹1L
    const b4 = list.filter((i) => i.absBal > 10000000); // > ₹1L

    const sum = (arr: typeof list) => arr.reduce((s, x) => s + x.absBal, 0);

    return [
      { label: "< ₹10k", count: b1.length, total: sum(b1) },
      { label: "₹10k - ₹50k", count: b2.length, total: sum(b2) },
      { label: "₹50k - ₹1 Lakh", count: b3.length, total: sum(b3) },
      { label: "> ₹1 Lakh", count: b4.length, total: sum(b4) },
    ];
  }, [items]);

  const maxTotal = useMemo(() => Math.max(...brackets.map((b) => b.total), 1), [brackets]);
  const activeBracket = hoveredIdx !== null ? brackets[hoveredIdx] : null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {title}
          </p>
          <p className="text-[10px] text-zinc-400">{subtitle}</p>
        </div>
        {activeBracket && (
          <div className="px-2.5 py-1 rounded text-xs font-semibold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {activeBracket.label}: <strong>{activeBracket.count} accounts</strong> ({formatINR(activeBracket.total)})
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1">
        {brackets.map((b, i) => {
          const pct = (b.total / maxTotal) * 100;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="space-y-1 group cursor-pointer"
            >
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-zinc-600 dark:text-zinc-400">{b.label}</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {b.count} parties ({formatINR(b.total)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    valueColor === "green"
                      ? "bg-green-500 group-hover:bg-green-400"
                      : "bg-red-500 group-hover:bg-red-400"
                  )}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** GST Tax Comparison Chart */
function GstTaxComparisonChart({ gst }: { gst: Gst }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const rows = [
    { label: "CGST (Central)", output: gst.output.cgst, input: gst.input.cgst },
    { label: "SGST (State)", output: gst.output.sgst, input: gst.input.sgst },
    { label: "IGST (Integrated)", output: gst.output.igst, input: gst.input.igst },
  ];

  const maxVal = Math.max(
    ...rows.map((r) => Math.max(r.output, r.input)),
    1
  );

  const activeRow = hoveredIdx !== null ? rows[hoveredIdx] : null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            GST Output vs Input Credit Breakdown
          </p>
          <p className="text-[10px] text-zinc-400">
            Comparative analysis of tax collected on sales vs ITC claimed on purchases
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500 inline-block" /> Output Tax
          </span>
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <span className="h-2.5 w-2.5 rounded-sm bg-green-500 inline-block" /> Input Credit
          </span>
        </div>
      </div>

      {activeRow && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          <span className="font-bold text-zinc-800 dark:text-zinc-100">{activeRow.label}</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>
              Output: <strong className="text-blue-600">{formatINR(activeRow.output)}</strong>
            </span>
            <span>
              ITC: <strong className="text-green-600">{formatINR(activeRow.input)}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-1">
        {rows.map((r, i) => {
          const outPct = (r.output / maxVal) * 100;
          const inpPct = (r.input / maxVal) * 100;

          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="space-y-1 group cursor-pointer"
            >
              <div className="flex justify-between text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                <span>{r.label}</span>
                <span>
                  Output: {formatINR(r.output)} | ITC: {formatINR(r.input)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 group-hover:bg-blue-400 transition-all"
                    style={{ width: `${Math.max(outPct, 2)}%` }}
                  />
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 group-hover:bg-green-400 transition-all"
                    style={{ width: `${Math.max(inpPct, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Stock Valuation Distribution Chart */
function StockValuationCategoryChart({ rows }: { rows: StockRow[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const categories = useMemo(() => {
    const map: Record<string, { count: number; value: number; qty: number }> = {};
    for (const r of rows) {
      const cat = r.categoryName || "General";
      if (!map[cat]) map[cat] = { count: 0, value: 0, qty: 0 };
      map[cat].count += 1;
      map[cat].value += r.value;
      map[cat].qty += r.qty;
    }
    return Object.entries(map).map(([name, data]) => ({ name, ...data }));
  }, [rows]);

  const maxVal = useMemo(() => Math.max(...categories.map((c) => c.value), 1), [categories]);
  const activeCat = hoveredIdx !== null ? categories[hoveredIdx] : null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Inventory Valuation by Category
          </p>
          <p className="text-[10px] text-zinc-400">
            Category-wise total product asset distribution
          </p>
        </div>
        {activeCat && (
          <div className="px-2.5 py-1 rounded text-xs font-semibold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {activeCat.name}: <strong>{activeCat.count} items</strong> ({formatINR(activeCat.value)})
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1">
        {categories.map((c, i) => {
          const pct = (c.value / maxVal) * 100;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="space-y-1 group cursor-pointer"
            >
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-zinc-600 dark:text-zinc-400">{c.name}</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {c.count} items ({formatINR(c.value)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 group-hover:bg-purple-400 transition-all"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortableTable<T extends Record<string, unknown>>({
  cols,
  rows,
  keyField,
  emptyMsg,
}: {
  cols: {
    key: keyof T;
    label: string;
    align?: "left" | "right" | "center";
    render?: (v: T[keyof T], row: T) => React.ReactNode;
  }[];
  rows: T[];
  keyField: keyof T;
  emptyMsg?: string;
}) {
  const [sort, setSort] = useState<{
    key: keyof T;
    dir: "asc" | "desc";
  } | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number")
        return sort.dir === "asc" ? av - bv : bv - av;
      return sort.dir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const doSort = (key: keyof T) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              {cols.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => doSort(col.key)}
                  className={cn(
                    "px-3.5 py-2.5 font-semibold text-zinc-500 cursor-pointer select-none whitespace-nowrap",
                    "hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30 no-print" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length}
                  className="py-12 text-center text-zinc-400 text-xs"
                >
                  {emptyMsg ?? "No transaction records found"}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={String(row[keyField])}
                  className={cn(
                    "border-b border-zinc-100 dark:border-zinc-800 last:border-none transition-colors",
                    i % 2 === 0
                      ? "bg-white dark:bg-zinc-950"
                      : "bg-zinc-50/40 dark:bg-zinc-900/30",
                    "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                  )}
                >
                  {cols.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn(
                        "px-3.5 py-2.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap",
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500 px-1 no-print">
          <span>
            Showing {(page - 1) * PER_PAGE + 1}–
            {Math.min(page * PER_PAGE, sorted.length)} of {sorted.length} entries
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ‹ Prev
            </button>
            <span className="px-2 py-1 text-zinc-600 dark:text-zinc-400 font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportBar({
  onCsv,
  onPrint,
}: {
  onCsv: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={onCsv}
        className="inline-flex items-center gap-1.5 rounded border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <Download className="h-3.5 w-3.5" /> Export CSV
      </button>
      <button
        onClick={onPrint}
        className="inline-flex items-center gap-1.5 rounded border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <Printer className="h-3.5 w-3.5" /> Print Report
      </button>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative no-print">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search records..."}
        className="pl-8 pr-8 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 w-56 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 placeholder:text-zinc-400"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({
  label,
  color,
}: {
  label: string;
  color: "green" | "red" | "amber" | "zinc" | "blue" | "purple";
}) {
  const cls = {
    green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    zinc: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
    purple:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
  }[color];
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border capitalize", cls)}>
      {label}
    </span>
  );
}

function PrintableReportHeader({ title, period }: { title: string; period: string }) {
  return (
    <div className="hidden print:block mb-6 border-b border-black pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-black uppercase tracking-wide">{title}</h1>
          <p className="text-xs text-gray-600 mt-1">Invoixe Financial Platform — Accounting Statement</p>
        </div>
        <div className="text-right text-xs text-gray-700">
          <p className="font-semibold">Period: {period}</p>
          <p>Generated: {new Date().toLocaleDateString("en-IN")}</p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Report Panels
// ──────────────────────────────────────────────────────────────────────────────

function SalesPanel({
  daybook,
  trend,
  summary,
  periodLabel,
  onPrint,
}: {
  daybook: TxRow[];
  trend: TrendPoint[];
  summary: Summary;
  periodLabel: string;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const sales = daybook.filter((r) => r.type === "sale");
  const filtered = sales.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.partyName?.toLowerCase().includes(q) || r.number?.toLowerCase().includes(q);
  });
  const avgPaise = sales.length > 0 ? Math.round(summary.sales / sales.length) : 0;

  return (
    <div
      data-report-panel="sales"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Total Sales Report" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox label="Total Sales Revenue" value={formatINR(summary.sales)} accent="border-l-4 border-l-green-500" />
        <KpiBox label="Total Sale Invoices" value={String(sales.length)} />
        <KpiBox label="Average Invoice Value" value={formatINR(avgPaise)} />
        <KpiBox label="Output GST Tax" value={formatINR(summary.outputTax)} sub="Tax collected on sales" />
      </div>

      {trend.length > 0 && (
        <InteractiveTrendBars
          points={trend}
          field="sales"
          title="Sales Performance Trend"
          color="green"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
        <SearchInput value={search} onChange={setSearch} placeholder="Search customer or invoice #..." />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{filtered.length} invoice records</span>
          <ExportBar
            onCsv={() =>
              downloadCsv(
                [
                  ["Invoice #", "Date", "Customer", "Payment Mode", "SubTotal (₹)", "Tax (₹)", "Grand Total (₹)"],
                  ...filtered.map((r) => [
                    r.number,
                    fmtDate(r.date),
                    r.partyName ?? "Cash Sale",
                    r.paymentMode ?? "—",
                    formatINR(r.subTotal ?? 0),
                    formatINR(r.totalTax ?? 0),
                    formatINR(r.grandTotal),
                  ]),
                ],
                "sales-report.csv"
              )
            }
            onPrint={onPrint}
          />
        </div>
      </div>

      <SortableTable<TxRow>
        keyField="id"
        cols={[
          {
            key: "number",
            label: "Invoice #",
            render: (v, row) => (
              <Link
                href={`/invoices/${row.id}`}
                className="font-bold text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1"
              >
                {String(v)}
                <ExternalLink className="h-3 w-3 opacity-60 no-print" />
              </Link>
            ),
          },
          { key: "date", label: "Date", render: (v) => fmtDate(String(v)) },
          {
            key: "partyName",
            label: "Customer / Party",
            render: (v, row) =>
              row.partyId ? (
                <Link
                  href={`/parties/${row.partyId}`}
                  className="font-medium text-zinc-800 dark:text-zinc-200 hover:underline inline-flex items-center gap-1"
                >
                  <Building2 className="h-3 w-3 text-zinc-400 no-print" />
                  {String(v ?? "Cash Sale")}
                </Link>
              ) : (
                <span className="text-zinc-500">{String(v ?? "Cash Sale")}</span>
              ),
          },
          {
            key: "paymentMode",
            label: "Payment Mode",
            render: (v) => <StatusBadge label={String(v ?? "cash")} color="zinc" />,
          },
          {
            key: "grandTotal",
            label: "Invoice Total",
            align: "right",
            render: (v) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatINR(Number(v))}</span>,
          },
        ]}
        rows={filtered}
        emptyMsg="No sales invoices recorded for this time period"
      />
    </div>
  );
}

function PurchasesPanel({
  daybook,
  trend,
  summary,
  periodLabel,
  onPrint,
}: {
  daybook: TxRow[];
  trend: TrendPoint[];
  summary: Summary;
  periodLabel: string;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const purchases = daybook.filter((r) => r.type === "purchase");
  const filtered = purchases.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.partyName?.toLowerCase().includes(q) || r.number?.toLowerCase().includes(q);
  });
  const avgPaise = purchases.length > 0 ? Math.round(summary.purchases / purchases.length) : 0;

  return (
    <div
      data-report-panel="purchases"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Purchases Report" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox label="Total Purchase Cost" value={formatINR(summary.purchases)} accent="border-l-4 border-l-blue-500" />
        <KpiBox label="Purchase Bills" value={String(purchases.length)} />
        <KpiBox label="Average Bill Value" value={formatINR(avgPaise)} />
        <KpiBox label="Input GST Credit (ITC)" value={formatINR(summary.inputTax)} sub="Claimable ITC" />
      </div>

      {trend.length > 0 && (
        <InteractiveTrendBars
          points={trend}
          field="purchases"
          title="Purchase Outflow Trend"
          color="blue"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier or bill #..." />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{filtered.length} purchase bills</span>
          <ExportBar
            onCsv={() =>
              downloadCsv(
                [
                  ["Bill #", "Date", "Supplier", "Payment Mode", "Bill Amount (₹)"],
                  ...filtered.map((r) => [
                    r.number,
                    fmtDate(r.date),
                    r.partyName ?? "Supplier",
                    r.paymentMode ?? "—",
                    formatINR(r.grandTotal),
                  ]),
                ],
                "purchases-report.csv"
              )
            }
            onPrint={onPrint}
          />
        </div>
      </div>

      <SortableTable<TxRow>
        keyField="id"
        cols={[
          {
            key: "number",
            label: "Bill / Ref #",
            render: (v) => <span className="font-semibold text-zinc-800 dark:text-zinc-200">{String(v)}</span>,
          },
          { key: "date", label: "Date", render: (v) => fmtDate(String(v)) },
          {
            key: "partyName",
            label: "Supplier Name",
            render: (v, row) =>
              row.partyId ? (
                <Link
                  href={`/parties/${row.partyId}`}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <Building2 className="h-3 w-3 text-zinc-400 no-print" />
                  {String(v ?? "Supplier")}
                </Link>
              ) : (
                <span>{String(v ?? "Supplier")}</span>
              ),
          },
          {
            key: "paymentMode",
            label: "Mode",
            render: (v) => <StatusBadge label={String(v ?? "bank_transfer")} color="blue" />,
          },
          {
            key: "grandTotal",
            label: "Bill Total",
            align: "right",
            render: (v) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatINR(Number(v))}</span>,
          },
        ]}
        rows={filtered}
        emptyMsg="No purchase bills recorded for this time period"
      />
    </div>
  );
}

function ExpensesPanel({
  daybook,
  trend,
  summary,
  periodLabel,
  onPrint,
}: {
  daybook: TxRow[];
  trend: TrendPoint[];
  summary: Summary;
  periodLabel: string;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const expenses = daybook.filter((r) => r.type === "expense");
  const filtered = expenses.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.partyName?.toLowerCase().includes(q) ||
      r.number?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  });
  const avgPaise = expenses.length > 0 ? Math.round(summary.expenses / expenses.length) : 0;

  return (
    <div
      data-report-panel="expenses"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Expenses Report" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiBox label="Total Expenses" value={formatINR(summary.expenses)} accent="border-l-4 border-l-red-500" />
        <KpiBox label="Expense Records" value={String(expenses.length)} />
        <KpiBox label="Average per Expense" value={formatINR(avgPaise)} />
      </div>

      {trend.length > 0 && (
        <InteractiveTrendBars
          points={trend}
          field="expenses"
          title="Operating Expense Outflow Trend"
          color="red"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
        <SearchInput value={search} onChange={setSearch} placeholder="Search expense category or ref..." />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{filtered.length} expense entries</span>
          <ExportBar
            onCsv={() =>
              downloadCsv(
                [
                  ["Ref #", "Date", "Category / Payee", "Payment Mode", "Expense Amount (₹)"],
                  ...filtered.map((r) => [
                    r.number,
                    fmtDate(r.date),
                    r.category || r.partyName || "General Expense",
                    r.paymentMode ?? "—",
                    formatINR(r.grandTotal),
                  ]),
                ],
                "expenses-report.csv"
              )
            }
            onPrint={onPrint}
          />
        </div>
      </div>

      <SortableTable<TxRow>
        keyField="id"
        cols={[
          { key: "number", label: "Ref #" },
          { key: "date", label: "Date", render: (v) => fmtDate(String(v)) },
          {
            key: "category",
            label: "Category / Payee",
            render: (v, row) => (
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {String(v || row.partyName || "General Expense")}
              </span>
            ),
          },
          {
            key: "paymentMode",
            label: "Mode",
            render: (v) => <StatusBadge label={String(v ?? "cash")} color="red" />,
          },
          {
            key: "grandTotal",
            label: "Amount",
            align: "right",
            render: (v) => <span className="font-bold text-red-600 dark:text-red-400">{formatINR(Number(v))}</span>,
          },
        ]}
        rows={filtered}
        emptyMsg="No expense entries recorded for this time period"
      />
    </div>
  );
}

function GrossProfitPanel({
  summary,
  trend,
  periodLabel,
  onPrint,
}: {
  summary: Summary;
  trend: TrendPoint[];
  periodLabel: string;
  onPrint: () => void;
}) {
  const { sales, purchases, expenses, grossProfit } = summary;
  const grossMarginPct = sales > 0 ? (grossProfit / sales) * 100 : 0;
  const isProfit = grossProfit >= 0;

  const plRows = [
    { label: "Total Revenue (Sales)", value: sales, indent: false, bold: false },
    { label: "Less: Direct Cost of Goods Sold (Purchases)", value: -purchases, indent: true, bold: false },
    { label: "Less: Operating Expenses", value: -expenses, indent: true, bold: false },
    { label: "Net Gross Profit / (Loss)", value: grossProfit, indent: false, bold: true },
  ];

  return (
    <div
      data-report-panel="profit"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Gross Profit & Margin Report" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox label="Revenue (Sales)" value={formatINR(sales)} accent="border-l-4 border-l-green-500" />
        <KpiBox label="Purchases (COGS)" value={formatINR(purchases)} />
        <KpiBox label="Operating Expenses" value={formatINR(expenses)} />
        <KpiBox
          label="Net Profit"
          value={formatINR(Math.abs(grossProfit))}
          sub={isProfit ? `Margin: ${grossMarginPct.toFixed(1)}%` : "Net Loss"}
          accent={isProfit ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"}
        />
      </div>

      {/* Financial P&L Statement */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
        <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Profit & Loss Summary Statement
          </p>
          <span className="text-[10px] font-semibold text-zinc-400">All figures in INR (₹)</span>
        </div>
        {plRows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between px-5 py-3 border-b last:border-none border-zinc-100 dark:border-zinc-800",
              row.bold && "bg-zinc-50/70 dark:bg-zinc-900/40"
            )}
          >
            <span
              className={cn(
                "text-xs text-zinc-700 dark:text-zinc-300",
                row.indent && "pl-6 text-zinc-500",
                row.bold && "font-bold text-zinc-900 dark:text-zinc-100"
              )}
            >
              {row.label}
            </span>
            <span
              className={cn(
                "text-xs tabular-nums",
                row.bold
                  ? isProfit
                    ? "font-bold text-green-600 text-sm"
                    : "font-bold text-red-500 text-sm"
                  : row.value < 0
                  ? "text-red-500 font-medium"
                  : "text-zinc-800 dark:text-zinc-200 font-medium"
              )}
            >
              {row.value < 0 ? `(${formatINR(Math.abs(row.value))})` : formatINR(row.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Gross Margin Progress bar */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2 shadow-xs">
        <div className="flex justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>Profitability Ratio (Gross Margin)</span>
          <span>{grossMarginPct.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", isProfit ? "bg-green-500" : "bg-red-500")}
            style={{ width: `${Math.min(Math.abs(grossMarginPct), 100)}%` }}
          />
        </div>
      </div>

      {/* Real-time Profitability Trend Chart */}
      {trend.length > 0 && <ProfitabilityTrendChart points={trend} />}

      <ExportBar
        onCsv={() =>
          downloadCsv(
            [
              ["Financial Metric", "Amount (₹)"],
              ["Total Revenue (Sales)", formatINR(sales)],
              ["Direct Cost of Goods Sold", formatINR(purchases)],
              ["Operating Expenses", formatINR(expenses)],
              ["Net Gross Profit", formatINR(grossProfit)],
              ["Gross Margin %", `${grossMarginPct.toFixed(1)}%`],
            ],
            "profit-and-loss-statement.csv"
          )
        }
        onPrint={onPrint}
      />
    </div>
  );
}

function ReceivablesPanel({
  outstanding,
  periodLabel,
  onPrint,
}: {
  outstanding: Outstanding[];
  periodLabel: string;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const receivables = outstanding.filter((r) => r.balance > 0);
  const filtered = receivables.filter(
    (r) => !search || r.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPaise = receivables.reduce((s, r) => s + r.balance, 0);
  const avgPaise = receivables.length > 0 ? Math.round(totalPaise / receivables.length) : 0;

  return (
    <div
      data-report-panel="receivables"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Receivables Report (Debtors)" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiBox label="Total Receivables" value={formatINR(totalPaise)} accent="border-l-4 border-l-green-500" />
        <KpiBox label="Debtors / Customers" value={String(receivables.length)} />
        <KpiBox label="Avg Customer Debt" value={formatINR(avgPaise)} />
      </div>

      {/* Receivables Aging Distribution Chart */}
      {receivables.length > 0 && (
        <DebtDistributionChart
          items={receivables}
          title="Customer Receivables Distribution"
          subtitle="Breakdown of debtor accounts grouped by balance amount"
          valueColor="green"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
        <SearchInput value={search} onChange={setSearch} placeholder="Search debtor customer..." />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{filtered.length} customer accounts</span>
          <ExportBar
            onCsv={() =>
              downloadCsv(
                [
                  ["Customer Name", "Phone", "Account Type", "Outstanding Balance (₹)"],
                  ...filtered.map((r) => [r.name, r.phone ?? "—", r.type, formatINR(r.balance)]),
                ],
                "receivables-report.csv"
              )
            }
            onPrint={onPrint}
          />
        </div>
      </div>

      <SortableTable<Outstanding>
        keyField="id"
        cols={[
          {
            key: "name",
            label: "Customer / Party",
            render: (v, row) => (
              <Link
                href={`/parties/${row.id}`}
                className="font-semibold text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5 text-zinc-400 no-print" />
                {String(v)}
              </Link>
            ),
          },
          { key: "phone", label: "Phone", render: (v) => String(v ?? "—") },
          {
            key: "type",
            label: "Type",
            render: (v) => <StatusBadge label={String(v)} color="zinc" />,
          },
          {
            key: "balance",
            label: "Receivable Amount",
            align: "right",
            render: (v) => <span className="font-bold text-green-600 dark:text-green-400">{formatINR(Number(v))}</span>,
          },
        ]}
        rows={filtered}
        emptyMsg="No customer receivables outstanding — all accounts are fully settled"
      />
    </div>
  );
}

function PayablesPanel({
  outstanding,
  periodLabel,
  onPrint,
}: {
  outstanding: Outstanding[];
  periodLabel: string;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const payables = outstanding
    .filter((r) => r.balance < 0)
    .map((r) => ({ ...r, balance: Math.abs(r.balance) }));
  const filtered = payables.filter(
    (r) => !search || r.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPaise = payables.reduce((s, r) => s + r.balance, 0);
  const avgPaise = payables.length > 0 ? Math.round(totalPaise / payables.length) : 0;

  return (
    <div
      data-report-panel="payables"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Payables Report (Creditors)" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiBox label="Total Supplier Payables" value={formatINR(totalPaise)} accent="border-l-4 border-l-red-500" />
        <KpiBox label="Creditors / Suppliers" value={String(payables.length)} />
        <KpiBox label="Avg Supplier Payable" value={formatINR(avgPaise)} />
      </div>

      {/* Payables Aging Distribution Chart */}
      {payables.length > 0 && (
        <DebtDistributionChart
          items={payables}
          title="Supplier Payables Distribution"
          subtitle="Breakdown of creditor accounts grouped by balance amount"
          valueColor="red"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier..." />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{filtered.length} supplier accounts</span>
          <ExportBar
            onCsv={() =>
              downloadCsv(
                [
                  ["Supplier Name", "Phone", "Account Type", "Payable Amount (₹)"],
                  ...filtered.map((r) => [r.name, r.phone ?? "—", r.type, formatINR(r.balance)]),
                ],
                "payables-report.csv"
              )
            }
            onPrint={onPrint}
          />
        </div>
      </div>

      <SortableTable<Outstanding>
        keyField="id"
        cols={[
          {
            key: "name",
            label: "Supplier Name",
            render: (v, row) => (
              <Link
                href={`/parties/${row.id}`}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5 text-zinc-400 no-print" />
                {String(v)}
              </Link>
            ),
          },
          { key: "phone", label: "Phone", render: (v) => String(v ?? "—") },
          {
            key: "type",
            label: "Type",
            render: (v) => <StatusBadge label={String(v)} color="zinc" />,
          },
          {
            key: "balance",
            label: "Payable Amount",
            align: "right",
            render: (v) => <span className="font-bold text-red-500 dark:text-red-400">{formatINR(Number(v))}</span>,
          },
        ]}
        rows={filtered}
        emptyMsg="No supplier payables outstanding — all accounts are fully settled"
      />
    </div>
  );
}

function GstPanel({
  gst,
  periodLabel,
  onPrint,
}: {
  gst: Gst;
  periodLabel: string;
  onPrint: () => void;
}) {
  const outputTax = gst.output.total;
  const inputTax = gst.input.total;
  const netPayable = gst.netPayable;
  const isLiability = netPayable > 0;

  const breakdown = [
    { label: "CGST (Central Tax)", out: gst.output.cgst, inp: gst.input.cgst },
    { label: "SGST / UTGST (State Tax)", out: gst.output.sgst, inp: gst.input.sgst },
    { label: "IGST (Integrated Tax)", out: gst.output.igst, inp: gst.input.igst },
  ];

  return (
    <div
      data-report-panel="gst"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="GST Tax Computation Report (GSTR-3B)" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox label="Output GST (Sales)" value={formatINR(outputTax)} accent="border-l-4 border-l-blue-500" />
        <KpiBox label="Input GST (ITC)" value={formatINR(inputTax)} accent="border-l-4 border-l-green-500" />
        <KpiBox
          label="Net GST Liability"
          value={formatINR(Math.abs(netPayable))}
          sub={isLiability ? "Net Tax Due" : "ITC Surplus"}
          accent={isLiability ? "border-l-4 border-l-red-500" : "border-l-4 border-l-green-500"}
        />
        <KpiBox label="Taxable Turnover" value={formatINR(gst.output.taxable)} />
      </div>

      {/* GST Output vs Input Comparison Chart */}
      <GstTaxComparisonChart gst={gst} />

      {/* Tax Component Matrix */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
        <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            GST Tax Computation Matrix (GSTR-3B)
          </p>
          <Link
            href="/gst"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 no-print"
          >
            Filing Portal <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-4 py-2.5 text-left text-zinc-500 font-semibold">Tax Component</th>
                <th className="px-4 py-2.5 text-right text-zinc-500 font-semibold">Output Tax Collected</th>
                <th className="px-4 py-2.5 text-right text-zinc-500 font-semibold">Input Credit (ITC)</th>
                <th className="px-4 py-2.5 text-right text-zinc-500 font-semibold">Net Payable / (Credit)</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, i) => {
                const net = row.out - row.inp;
                return (
                  <tr
                    key={i}
                    className={cn(
                      "border-b border-zinc-100 dark:border-zinc-800 last:border-none",
                      i % 2 === 0 ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/40 dark:bg-zinc-900/30"
                    )}
                  >
                    <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200 font-medium">{row.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatINR(row.out)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatINR(row.inp)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-bold tabular-nums",
                        net > 0 ? "text-red-500" : "text-green-600"
                      )}
                    >
                      {formatINR(Math.abs(net))}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-zinc-100/70 dark:bg-zinc-800/40 border-t-2 border-zinc-200 dark:border-zinc-700">
                <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-zinc-100">Total Tax Summary</td>
                <td className="px-4 py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatINR(outputTax)}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatINR(inputTax)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-bold text-sm tabular-nums",
                    isLiability ? "text-red-500" : "text-green-600"
                  )}
                >
                  {formatINR(Math.abs(netPayable))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Liability / Credit Banner */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          isLiability
            ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20"
            : "border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-950/20"
        )}
      >
        {isLiability ? (
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p
            className={cn(
              "text-xs font-bold",
              isLiability ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
            )}
          >
            {isLiability
              ? `Net GST Tax Payable: ${formatINR(netPayable)}`
              : `ITC Surplus Available: ${formatINR(Math.abs(netPayable))}`}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px]",
              isLiability ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"
            )}
          >
            {isLiability
              ? "Ensure your GSTR-3B return is filed and output tax liability is settled on or before the due date."
              : "Your Input Tax Credit exceeds Output Tax collected on sales. The surplus will be carried forward to next month's return."}
          </p>
        </div>
      </div>

      <ExportBar
        onCsv={() =>
          downloadCsv(
            [
              ["Tax Component", "Output Tax Collected (₹)", "Input Tax Credit (₹)", "Net Payable (₹)"],
              ...breakdown.map((r) => [r.label, formatINR(r.out), formatINR(r.inp), formatINR(Math.abs(r.out - r.inp))]),
              ["Total GST", formatINR(outputTax), formatINR(inputTax), formatINR(Math.abs(netPayable))],
            ],
            "gst-summary-report.csv"
          )
        }
        onPrint={onPrint}
      />
    </div>
  );
}

function StockPanel({
  stock,
  periodLabel,
  onPrint,
}: {
  stock: Stock;
  periodLabel: string;
  onPrint: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const lowItems = stock.rows.filter((r) => r.low);
  const outOfStock = stock.rows.filter((r) => r.qty <= 0);

  const filtered = stock.rows.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || r.name.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q) || r.categoryName?.toLowerCase().includes(q);
    const matchStatus =
      !statusFilter ||
      (statusFilter === "low" && r.low && r.qty > 0) ||
      (statusFilter === "out" && r.qty <= 0) ||
      (statusFilter === "ok" && !r.low && r.qty > 0);
    return matchSearch && matchStatus;
  });

  return (
    <div
      data-report-panel="stock"
      className="p-5 space-y-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10"
    >
      <PrintableReportHeader title="Inventory Valuation & Stock Report" period={periodLabel} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox label="Total Inventory Value" value={formatINR(stock.totalValue)} accent="border-l-4 border-l-purple-500" />
        <KpiBox label="Tracked Items" value={String(stock.rows.length)} />
        <KpiBox
          label="Low Stock Items"
          value={String(lowItems.length)}
          accent={lowItems.length > 0 ? "border-l-4 border-l-amber-500" : undefined}
        />
        <KpiBox
          label="Out of Stock"
          value={String(outOfStock.length)}
          accent={outOfStock.length > 0 ? "border-l-4 border-l-red-500" : undefined}
        />
      </div>

      {/* Stock Valuation by Category Distribution Chart */}
      {stock.rows.length > 0 && <StockValuationCategoryChart rows={stock.rows} />}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search product name, SKU..." />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 pl-2.5 pr-6 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Stock Status</option>
            <option value="ok">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{filtered.length} products</span>
          <ExportBar
            onCsv={() =>
              downloadCsv(
                [
                  ["Item Name", "SKU / Code", "Category", "Stock Qty", "Unit", "Purchase Price (₹)", "Stock Value (₹)", "Status"],
                  ...filtered.map((r) => [
                    r.name,
                    r.itemCode ?? "—",
                    r.categoryName ?? "General",
                    String(r.qty),
                    r.unit,
                    formatINR(r.purchasePrice),
                    formatINR(r.value),
                    r.qty <= 0 ? "Out of Stock" : r.low ? "Low Stock" : "In Stock",
                  ]),
                ],
                "inventory-valuation-report.csv"
              )
            }
            onPrint={onPrint}
          />
        </div>
      </div>

      <SortableTable<StockRow>
        keyField="id"
        cols={[
          {
            key: "name",
            label: "Product / Item",
            render: (v, row) => (
              <div>
                <Link href="/items" className="font-bold text-zinc-800 dark:text-zinc-100 hover:underline">
                  {String(v)}
                </Link>
                {row.itemCode && <p className="text-[10px] text-zinc-400">SKU: {row.itemCode}</p>}
              </div>
            ),
          },
          { key: "categoryName", label: "Category", render: (v) => String(v ?? "General") },
          {
            key: "qty",
            label: "Stock Qty",
            align: "right",
            render: (v, row) => (
              <span
                className={cn(
                  "font-bold tabular-nums",
                  row.qty <= 0
                    ? "text-red-500"
                    : row.low
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-zinc-800 dark:text-zinc-200"
                )}
              >
                {String(v)} {row.unit}
              </span>
            ),
          },
          {
            key: "purchasePrice",
            label: "Cost Price",
            align: "right",
            render: (v) => <span className="tabular-nums">{formatINR(Number(v))}</span>,
          },
          {
            key: "value",
            label: "Valuation",
            align: "right",
            render: (v) => <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{formatINR(Number(v))}</span>,
          },
          {
            key: "low",
            label: "Status",
            render: (_v, row) => {
              if (row.qty <= 0) return <StatusBadge label="Out of Stock" color="red" />;
              if (row.low) return <StatusBadge label="Low Stock" color="amber" />;
              return <StatusBadge label="In Stock" color="green" />;
            },
          },
        ]}
        rows={filtered}
        emptyMsg="No items match your inventory search"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Accordion & Report Container Components
// ──────────────────────────────────────────────────────────────────────────────

function SectionAccordion({
  id,
  title,
  icon: Icon,
  accentColor,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  accentColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = usePersistentOpen(`report-section-${id}`, defaultOpen);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs"
    >
      <Collapsible.Trigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between px-5 py-4 text-left transition-colors no-print",
            "hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
            open && "border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs", accentColor)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-xs font-medium hidden sm:inline">{open ? "Collapse section" : "Expand section"}</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180 text-zinc-700 dark:text-zinc-300")}
            />
          </div>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

function ReportRow({
  label,
  value,
  sub,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 last:border-none">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-5 py-4 text-left transition-colors group no-print",
          isOpen ? "bg-zinc-50 dark:bg-zinc-900/60" : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-200",
              isOpen && "rotate-90 text-zinc-800 dark:text-zinc-200"
            )}
          />
          <span
            className={cn(
              "text-sm font-semibold truncate transition-colors",
              isOpen
                ? "text-zinc-900 dark:text-zinc-50 font-bold"
                : "text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
            )}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
            {sub && <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">{sub}</p>}
          </div>
          <span
            className={cn(
              "text-xs font-semibold px-3 py-1 rounded border transition-all shrink-0 shadow-xs",
              isOpen
                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 group-hover:border-zinc-400 dark:group-hover:border-zinc-500"
            )}
          >
            {isOpen ? "Close Report" : "Open Report"}
          </span>
        </div>
      </button>

      {isOpen && children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Reports Page Component
// ──────────────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [range, setRange] = useState("1M");
  const [openPL, setOpenPL] = useState<string | null>(null);
  const [openBT, setOpenBT] = useState<string | null>(null);
  const [printingReportKey, setPrintingReportKey] = useState<string | null>(null);

  // Queries connected to backend database API
  const {
    data: summary,
    refetch: refetchSummary,
    isFetching: fetchingS,
  } = useQuery({
    queryKey: ["r-summary", range],
    queryFn: () => api.get<Summary>(`/api/reports/summary?range=${range}`),
  });

  const { data: gst, refetch: refetchGst } = useQuery({
    queryKey: ["r-gst", range],
    queryFn: () => api.get<Gst>(`/api/reports/gst?range=${range}`),
  });

  const { data: outstanding, refetch: refetchOut } = useQuery({
    queryKey: ["r-outstanding"],
    queryFn: () => api.get<Outstanding[]>("/api/reports/outstanding"),
  });

  const { data: stock, refetch: refetchStock } = useQuery({
    queryKey: ["r-stock"],
    queryFn: () => api.get<Stock>("/api/reports/stock"),
  });

  const { data: daybook, refetch: refetchDaybook } = useQuery({
    queryKey: ["r-daybook", range],
    queryFn: () => api.get<TxRow[]>(`/api/reports/daybook?range=${range}`),
  });

  const { data: trend, refetch: refetchTrend } = useQuery({
    queryKey: ["r-trend", range],
    queryFn: () => api.get<TrendPoint[]>(`/api/reports/trend?range=${range}`),
  });

  const refetchAll = () => {
    refetchSummary();
    refetchGst();
    refetchOut();
    refetchStock();
    refetchDaybook();
    refetchTrend();
  };

  const handlePrint = useCallback((reportKey: string) => {
    setPrintingReportKey(reportKey);
    setTimeout(() => {
      window.print();
      setPrintingReportKey(null);
    }, 100);
  }, []);

  const s = summary ?? {
    sales: 0,
    purchases: 0,
    expenses: 0,
    outputTax: 0,
    inputTax: 0,
    grossProfit: 0,
    receivables: 0,
    payables: 0,
  };

  const gstData = gst ?? {
    output: { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
    input: { cgst: 0, sgst: 0, igst: 0, total: 0 },
    netPayable: 0,
  };

  const outData = outstanding ?? [];
  const stockData = stock ?? { rows: [], totalValue: 0 };
  const daybookData = daybook ?? [];
  const trendData = trend ?? [];

  const togglePL = (id: string) => setOpenPL((p) => (p === id ? null : id));
  const toggleBT = (id: string) => setOpenBT((p) => (p === id ? null : id));

  const periodLabel = RANGES.find((r) => r.value === range)?.label ?? "This Month";

  return (
    <main className="mx-auto max-w-[1450px] px-4 sm:px-6 py-8 space-y-6">
      {/* Dynamic CSS Print Stylesheet */}
      <style>{`
        @media print {
          /* Hide app shell, navigation, page header, period filter, action buttons, search bars */
          .no-print,
          header,
          nav,
          aside,
          button,
          input,
          select,
          .no-print-area {
            display: none !important;
          }

          /* Hide all non-printing elements when printing a specific report */
          ${
            printingReportKey
              ? `
            body * {
              visibility: hidden !important;
            }
            [data-report-panel="${printingReportKey}"],
            [data-report-panel="${printingReportKey}"] * {
              visibility: visible !important;
            }
            [data-report-panel="${printingReportKey}"] {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 20px !important;
              background: #fff !important;
              color: #000 !important;
              box-shadow: none !important;
              border: none !important;
            }
          `
              : ""
          }

          /* General print cleanups */
          body {
            background: #fff !important;
            color: #000 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border-bottom: 1px solid #e5e7eb !important;
            color: #000 !important;
          }
          a {
            text-decoration: none !important;
            color: #000 !important;
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-2 no-print">
        <PageHeader
          title="Accounting Reports"
          description="Real-time financial statement reports — Profit & Loss, GST, Receivables, Payables & Stock Valuation."
          backHref="/"
          backLabel="Dashboard"
          className="mb-0"
        />

        {/* Global Date Range Filter & Refresh */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center gap-1 px-2 text-xs font-semibold text-zinc-500">
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Period:</span>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  range === r.value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={refetchAll}
            disabled={fetchingS}
            title="Refresh database records"
            className="p-1.5 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-l border-zinc-200 dark:border-zinc-800 ml-1 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", fetchingS && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Section 1: Profit & Loss ── */}
      <SectionAccordion
        id="pl"
        title="1. Profit & Loss Reports"
        icon={TrendingUp}
        accentColor="bg-green-600"
        defaultOpen
      >
        <ReportRow
          label="Total Sales Report"
          value={formatINR(s.sales)}
          sub="Revenue from sale invoices"
          isOpen={openPL === "sales"}
          onToggle={() => togglePL("sales")}
        >
          <SalesPanel
            daybook={daybookData}
            trend={trendData}
            summary={s}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("sales")}
          />
        </ReportRow>

        <ReportRow
          label="Purchases Report"
          value={formatINR(s.purchases)}
          sub="Supplier bill costs"
          isOpen={openPL === "purchases"}
          onToggle={() => togglePL("purchases")}
        >
          <PurchasesPanel
            daybook={daybookData}
            trend={trendData}
            summary={s}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("purchases")}
          />
        </ReportRow>

        <ReportRow
          label="Expenses Report"
          value={formatINR(s.expenses)}
          sub="Operational spending"
          isOpen={openPL === "expenses"}
          onToggle={() => togglePL("expenses")}
        >
          <ExpensesPanel
            daybook={daybookData}
            trend={trendData}
            summary={s}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("expenses")}
          />
        </ReportRow>

        <ReportRow
          label="Gross Profit & Margin Report"
          value={formatINR(Math.abs(s.grossProfit))}
          sub={s.grossProfit >= 0 ? "Net Profit" : "Net Loss"}
          isOpen={openPL === "profit"}
          onToggle={() => togglePL("profit")}
        >
          <GrossProfitPanel
            summary={s}
            trend={trendData}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("profit")}
          />
        </ReportRow>
      </SectionAccordion>

      {/* ── Section 2: Balance & Taxes ── */}
      <SectionAccordion
        id="bt"
        title="2. Balance & Taxes Reports"
        icon={Receipt}
        accentColor="bg-blue-600"
        defaultOpen
      >
        <ReportRow
          label="Receivables (Customer Debtors)"
          value={formatINR(s.receivables)}
          sub="Owed to you by customers"
          isOpen={openBT === "receivables"}
          onToggle={() => toggleBT("receivables")}
        >
          <ReceivablesPanel
            outstanding={outData}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("receivables")}
          />
        </ReportRow>

        <ReportRow
          label="Payables (Supplier Creditors)"
          value={formatINR(s.payables)}
          sub="You owe to suppliers"
          isOpen={openBT === "payables"}
          onToggle={() => toggleBT("payables")}
        >
          <PayablesPanel
            outstanding={outData}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("payables")}
          />
        </ReportRow>

        <ReportRow
          label="GST Computation & Filing Report"
          value={formatINR(Math.abs(gstData.netPayable))}
          sub={gstData.netPayable > 0 ? "Net Tax Due" : "ITC Surplus"}
          isOpen={openBT === "gst"}
          onToggle={() => toggleBT("gst")}
        >
          <GstPanel
            gst={gstData}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("gst")}
          />
        </ReportRow>

        <ReportRow
          label="Inventory Valuation & Stock Report"
          value={formatINR(stockData.totalValue)}
          sub={`${stockData.rows.length} product items tracked`}
          isOpen={openBT === "stock"}
          onToggle={() => toggleBT("stock")}
        >
          <StockPanel
            stock={stockData}
            periodLabel={periodLabel}
            onPrint={() => handlePrint("stock")}
          />
        </ReportRow>
      </SectionAccordion>
    </main>
  );
}
