"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  Users,
  Package,
  Wallet,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Search,
  Percent,
  Activity,
  FileText,
  ShoppingCart,
  Zap,
  ExternalLink,
  type LucideIcon
} from "lucide-react";
import { formatINR } from "@invoixe/core";
import { api } from "../lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// --- Typings ---
type DashboardData = {
  todaySales: number;
  partiesCount: number;
  newPartiesThisWeek: number;
  itemsCount: number;
  lowStock: number;
  cashBank: number;
};

type SummaryData = {
  sales: number;
  purchases: number;
  expenses: number;
  outputTax: number;
  inputTax: number;
  grossProfit: number;
  receivables: number;
  payables: number;
};

type DaybookEntry = {
  id: string;
  type: "sale" | "purchase" | "expense" | "payment" | string;
  number: string;
  date: string;
  partyName: string;
  grandTotal: number;
};

type OutstandingEntry = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type StockEntry = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  minStock: number;
  value: number;
  low: boolean;
};

type StockResponse = {
  rows: StockEntry[];
  totalValue: number;
};



// --- KPI Card Sub-component ---
function KPICard({
  label,
  value,
  icon: Icon,
  trend,
  colorClass,
  loading
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { text: string; up: boolean };
  colorClass: string;
  loading: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <div className={cn("absolute inset-x-0 top-0 h-1.5", colorClass)} />
      <CardContent className="flex flex-col justify-between gap-4 p-6">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {label}
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-600 transition-colors group-hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:bg-zinc-850">
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {value}
            </h2>
            {trend && (
              <div className="mt-2 flex items-center gap-1 text-xs">
                {trend.up ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className={trend.up ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                  {trend.text}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// === 1. Headline KPIs Widget ===
export function DashboardKPIs() {
  const { data: d, isLoading: dLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/reports/dashboard"),
  });

  const { data: s, isLoading: sLoading } = useQuery<SummaryData>({
    queryKey: ["summary", { monthOnly: true }],
    queryFn: () => api.get<SummaryData>("/api/reports/summary?monthOnly=true"),
  });

  const isLoading = dLoading || sLoading;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        label="Today's Sales"
        icon={IndianRupee}
        value={formatINR(d?.todaySales ?? 0)}
        trend={{ text: "Updated live", up: true }}
        colorClass="bg-gradient-to-r from-emerald-500 to-green-600"
        loading={isLoading}
      />
      <KPICard
        label="Current Balance"
        icon={Wallet}
        value={formatINR(d?.cashBank ?? 0)}
        trend={
          (d?.cashBank ?? 0) >= 0
            ? { text: "Capital healthy", up: true }
            : { text: "Account overdraft", up: false }
        }
        colorClass="bg-gradient-to-r from-blue-500 to-indigo-600"
        loading={isLoading}
      />
      <KPICard
        label="Cash & Bank"
        icon={Wallet}
        value={formatINR(d?.cashBank ?? 0)}
        trend={
          (d?.cashBank ?? 0) >= 0
            ? { text: "Capital healthy", up: true }
            : { text: "Account overdraft", up: false }
        }
        colorClass="bg-gradient-to-r from-teal-400 to-cyan-600"
        loading={isLoading}
      />
      <KPICard
        label="Gross Profit"
        icon={Percent}
        value={formatINR(s?.grossProfit ?? 0)}
        trend={
          (s?.sales ?? 0) > 0
            ? { text: `${Math.round(((s?.grossProfit ?? 0) / (s?.sales ?? 1)) * 100)}% profit margin`, up: (s?.grossProfit ?? 0) > 0 }
            : { text: "No sales logged", up: false }
        }
        colorClass="bg-gradient-to-r from-purple-500 to-fuchsia-600"
        loading={isLoading}
      />
    </div>
  );
}

// === 2. Sales vs Expenses SVG Chart ===
export function DashboardCharts() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { data: daybook, isLoading } = useQuery<DaybookEntry[]>({
    queryKey: ["daybook"],
    queryFn: () => api.get<DaybookEntry[]>("/api/reports/daybook"),
  });

  const { data: s } = useQuery<SummaryData>({
    queryKey: ["summary", { monthOnly: true }],
    queryFn: () => api.get<SummaryData>("/api/reports/summary?monthOnly=true"),
  });

  if (isLoading) {
    return (
      <Card className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </Card>
    );
  }

  // Last 7 days labels (e.g. "Jul 15")
  const dates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  }).reverse();

  const dateStrings = dates.map(d => d.toISOString().split("T")[0]!);
  const labels = dates.map(d => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));

  // Group daybook totals
  const salesByDate: Record<string, number> = {};
  const expensesByDate: Record<string, number> = {};

  dateStrings.forEach(ds => {
    salesByDate[ds] = 0;
    expensesByDate[ds] = 0;
  });

  daybook?.forEach(tx => {
    const ds = new Date(tx.date).toISOString().split("T")[0]!;
    if (tx.type === "sale") {
      salesByDate[ds] = (salesByDate[ds] ?? 0) + tx.grandTotal;
    } else if (tx.type === "purchase" || tx.type === "expense") {
      expensesByDate[ds] = (expensesByDate[ds] ?? 0) + tx.grandTotal;
    }
  });

  const salesValues = dateStrings.map(ds => salesByDate[ds] ?? 0);
  const expensesValues = dateStrings.map(ds => expensesByDate[ds] ?? 0);

  const hasRealData = dateStrings.some(ds => (salesByDate[ds] ?? 0) > 0 || (expensesByDate[ds] ?? 0) > 0);

  // Fallback visual data for empty/demo state to keep UX gorgeous
  const displaySales = hasRealData ? salesValues : [40000, 120000, 85000, 210000, 160000, 240000, 190000];
  const displayExpenses = hasRealData ? expensesValues : [30000, 70000, 60000, 130000, 95000, 150000, 120000];

  const totalSales = displaySales.reduce((a, b) => a + b, 0);
  const totalExpenses = displayExpenses.reduce((a, b) => a + b, 0);

  const maxVal = Math.max(...displaySales, ...displayExpenses, 10000);
  
  // Grid X positioning helper
  const scaleX = (idx: number) => 55 + idx * 64;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Dynamic Graph */}
      <Card className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Sales & Expense Trend
              {!hasRealData && (
                <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-200/50 hover:bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 font-semibold text-[9px] py-0 px-1.5 h-4.5">
                  Demo
                </Badge>
              )}
            </h3>
            <p className="text-xs text-gray-500">Comparing daily revenue against business outflows</p>
          </div>

          {/* Hover Status / Totals Display panel */}
          <div className="text-xs font-semibold self-start sm:self-center">
            {hoveredIdx !== null ? (
              <div className="bg-teal-50/50 dark:bg-teal-950/10 border border-teal-100/50 dark:border-teal-900/30 rounded-xl px-3 py-1.5 flex items-center gap-3">
                <span className="text-teal-700 dark:text-teal-400 font-extrabold">{labels[hoveredIdx]}</span>
                <span className="h-3 w-px bg-teal-200 dark:bg-teal-900" />
                <span className="text-gray-600 dark:text-gray-300">Sales: <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(displaySales[hoveredIdx] ?? 0)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Outflow: <strong className="text-rose-600 dark:text-rose-400">{formatINR(displayExpenses[hoveredIdx] ?? 0)}</strong></span>
              </div>
            ) : (
              <div className="bg-gray-50/80 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800 px-3 py-1.5 rounded-xl flex items-center gap-3">
                <span className="text-gray-400 dark:text-zinc-500 font-bold">7-Day Summary</span>
                <span className="h-3 w-px bg-gray-200 dark:bg-zinc-800" />
                <span className="text-gray-600 dark:text-gray-300">Sales: <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(totalSales)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Outflow: <strong className="text-rose-600 dark:text-rose-400">{formatINR(totalExpenses)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Graph View */}
        <div className="relative h-[200px] w-full">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
            {/* Dotted Grid lines */}
            <line x1="40" y1="140" x2="470" y2="140" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-900" />
            <line x1="40" y1="100" x2="470" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-900" />
            <line x1="40" y1="60" x2="470" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-900" />
            <line x1="40" y1="20" x2="470" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-900" />

            {/* Render Bars */}
            {displaySales.map((salesVal, idx) => {
              const x = scaleX(idx);
              const expenseVal = displayExpenses[idx] ?? 0;
              
              // Heights based on maximum val
              const sHeight = (salesVal / maxVal) * 115;
              const eHeight = (expenseVal / maxVal) * 115;
              
              const isHovered = hoveredIdx === idx;
              const hasHover = hoveredIdx !== null;
              
              return (
                <g key={`bar-group-${idx}`} className="transition-opacity duration-200">
                  {/* Sales Bar (Emerald) */}
                  <rect
                    x={x - 9}
                    y={140 - sHeight}
                    width="8"
                    height={Math.max(sHeight, 2)}
                    rx="2.5"
                    fill="#10b981"
                    className="transition-all duration-300"
                    opacity={hasHover ? (isHovered ? 1.0 : 0.4) : 0.85}
                  />
                  {/* Outflow Bar (Rose) */}
                  <rect
                    x={x + 1}
                    y={140 - eHeight}
                    width="8"
                    height={Math.max(eHeight, 2)}
                    rx="2.5"
                    fill="#f43f5e"
                    className="transition-all duration-300"
                    opacity={hasHover ? (isHovered ? 1.0 : 0.4) : 0.85}
                  />

                  {/* Invisible Hover Area Trigger */}
                  <rect
                    x={x - 25}
                    y={10}
                    width="50"
                    height="145"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                </g>
              );
            })}

            {/* X Labels */}
            {labels.map((lbl, idx) => (
              <text 
                key={`lbl-${idx}`} 
                x={scaleX(idx)} 
                y="162" 
                textAnchor="middle" 
                className={cn(
                  "text-[10px] font-bold transition-all duration-200",
                  hoveredIdx === idx ? "fill-teal-600 dark:fill-teal-400 font-extrabold" : "fill-gray-400 dark:fill-zinc-500"
                )}
              >
                {lbl}
              </text>
            ))}

            {/* Y axis indicators */}
            <text x="32" y="24" textAnchor="end" className="fill-gray-400 text-[9px] font-bold dark:fill-zinc-500">
              {formatINR(maxVal, false).split(".")[0]}
            </text>
            <text x="32" y="84" textAnchor="end" className="fill-gray-400 text-[9px] font-bold dark:fill-zinc-500">
              {formatINR(maxVal / 2, false).split(".")[0]}
            </text>
            <text x="32" y="144" textAnchor="end" className="fill-gray-400 text-[9px] font-bold dark:fill-zinc-500">
              0
            </text>
          </svg>
        </div>
      </Card>

      {/* Quick P&L Breakdown Panel */}
      <Card className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-[0_12px_30px_rgba(20,184,166,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-[0_12px_30px_rgba(20,184,166,0.03)]">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Operating Balance</h3>
        <p className="text-xs text-gray-500 mb-6">Net financial breakdown</p>

        <div className="space-y-4">
          <div className="group/item flex items-center justify-between rounded-2xl bg-emerald-50/40 p-4 transition-all duration-300 hover:bg-emerald-50 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Total Sales</p>
              <h4 className="text-xl font-extrabold text-emerald-600 mt-1 dark:text-emerald-400">{formatINR(s?.sales ?? 0)}</h4>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-transform group-hover/item:scale-110 dark:bg-emerald-950/40 dark:text-emerald-400 shadow-sm">
              <ArrowUpRight className="h-5.5 w-5.5" />
            </div>
          </div>

          <div className="group/item flex items-center justify-between rounded-2xl bg-rose-50/40 p-4 transition-all duration-300 hover:bg-rose-50 dark:bg-rose-950/10 dark:hover:bg-rose-950/20">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Purchases & Expenses</p>
              <h4 className="text-xl font-extrabold text-rose-600 mt-1 dark:text-rose-400">
                {formatINR((s?.purchases ?? 0) + (s?.expenses ?? 0))}
              </h4>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 transition-transform group-hover/item:scale-110 dark:bg-rose-950/40 dark:text-rose-400 shadow-sm">
              <ArrowDownRight className="h-5.5 w-5.5" />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-zinc-900 dark:bg-zinc-900/30">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <span>Gross Profit Margin</span>
              <span className={cn(
                "font-extrabold px-2 py-0.5 rounded-lg text-[11px] shadow-sm",
                (s?.sales && s.sales > 0 && s.grossProfit >= 0) 
                  ? "bg-emerald-500 text-white" 
                  : "bg-rose-500 text-white"
              )}>
                {s?.sales && s.sales > 0 ? `${Math.round((s.grossProfit / s.sales) * 100)}%` : "0%"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden shadow-inner">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  (s?.sales && s.sales > 0 && s.grossProfit >= 0) 
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                    : "bg-gradient-to-r from-rose-400 to-red-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                )}
                style={{
                  width: `${Math.min(
                    Math.max(s?.sales && s.sales > 0 ? (s.grossProfit / s.sales) * 100 : 0, 0),
                    100
                  )}%`
                }}
              />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-gray-400 dark:text-zinc-500 font-medium">
              GPM shows standard markup profitability across inventory trades and service billings.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// === 3. Searchable Transaction Feed (Daybook) ===
export function DashboardActivity() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "sale" | "purchase" | "expense">("all");

  const { data: daybook, isLoading } = useQuery<DaybookEntry[]>({
    queryKey: ["daybook"],
    queryFn: () => api.get<DaybookEntry[]>("/api/reports/daybook"),
  });

  const getFiltered = () => {
    if (!daybook) return [];
    return daybook.filter(entry => {
      const matchesQ =
        entry.partyName?.toLowerCase().includes(q.toLowerCase()) ||
        entry.number?.toLowerCase().includes(q.toLowerCase());
      const matchesFilter = filter === "all" || entry.type === filter;
      return matchesQ && matchesFilter;
    });
  };

  const list = getFiltered().slice(0, 50); // Show up to 50 matches

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "sale":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30";
      case "purchase":
        return "bg-amber-500/10 text-amber-600 border-amber-200/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30";
      case "expense":
        return "bg-rose-500/10 text-rose-600 border-rose-200/50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30";
      case "payment_in":
      case "payment_out":
        return "bg-blue-500/10 text-blue-600 border-blue-200/50 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-200/50 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/30";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sale":
        return "Sale";
      case "purchase":
        return "Purchase";
      case "expense":
        return "Expense";
      case "payment_in":
        return "Payment In";
      case "payment_out":
        return "Payment Out";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ");
    }
  };

  return (
    <Card className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-[0_12px_30px_rgba(20,184,166,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-[0_12px_30px_rgba(20,184,166,0.03)]">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
          <p className="text-xs text-gray-500">Latest invoices and operational bills logged</p>
        </div>
        
        {/* Segmented Filter Pills */}
        <div className="inline-flex rounded-xl bg-gray-100/80 p-1 dark:bg-zinc-900/60 border border-gray-200/20 dark:border-zinc-800/40 shadow-inner">
          {(["all", "sale", "purchase", "expense"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 capitalize",
                filter === f
                  ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {f === "all" ? "Show All" : f + "s"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 relative group">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-teal-500" />
        <Input
          placeholder="Search by invoice number or party name..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-10 pr-4 h-10 rounded-xl border-gray-200 bg-gray-50/30 dark:border-zinc-800 dark:bg-zinc-900/20 focus-visible:ring-1 focus-visible:ring-teal-500 text-xs"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-10 text-center">
          <Activity className="mx-auto h-8 w-8 text-gray-300 dark:text-zinc-700 animate-pulse" />
          <h4 className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-300">No matching activities</h4>
          <p className="text-xs text-gray-400 mt-1">Try tweaking filters or adding new transactions.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="grid grid-cols-6 gap-4 px-6 py-3.5 bg-gray-50/50 dark:bg-zinc-900/30 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-2 border border-gray-100 dark:border-zinc-900">
              <div className="col-span-1">Date & Time</div>
              <div className="col-span-1">Reference</div>
              <div className="col-span-2">Party Name</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1 text-right">Amount</div>
            </div>
            <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-800">
              {list.map(entry => {
                const isSale = entry.type === "sale";
                return (
                  <div 
                    key={entry.id} 
                    className="grid grid-cols-6 gap-4 items-center px-6 py-3 rounded-xl border border-transparent hover:bg-gray-50/50 hover:border-gray-100 dark:hover:bg-zinc-900/30 dark:hover:border-zinc-800/40 transition-all duration-200 group/tx cursor-pointer"
                  >
                    <div className="col-span-1 text-xs text-gray-500 dark:text-zinc-400 font-medium">
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </div>
                    <div className="col-span-1">
                      <span className="font-mono text-[11px] font-medium text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded border border-gray-200/50 dark:border-zinc-800/60">
                        {entry.number}
                      </span>
                    </div>
                    <div className="col-span-2 font-semibold text-[13px] text-gray-800 dark:text-gray-200 truncate">
                      {entry.partyName || "Cash Counter Sales"}
                    </div>
                    <div className="col-span-1">
                      <Badge className={cn("text-[9px] py-0 px-2 h-5 font-bold uppercase pointer-events-none rounded-md", getTypeStyle(entry.type))} variant="outline">
                        {getTypeLabel(entry.type)}
                      </Badge>
                    </div>
                    <div className={cn("col-span-1 text-right font-bold text-xs tracking-tight", isSale ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white")}>
                      {isSale ? "+" : "-"} {formatINR(entry.grandTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {list.map(entry => {
              const isSale = entry.type === "sale";
              return (
                <div 
                  key={entry.id} 
                  className="group/tx flex items-center justify-between p-3 rounded-2xl border border-transparent transition-all duration-300 hover:bg-gray-50/60 hover:border-gray-100 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:hover:bg-zinc-900/40 dark:hover:border-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs uppercase transition-transform group-hover/tx:scale-105 shadow-sm",
                        entry.type === "sale" && "bg-gradient-to-br from-emerald-400/10 to-teal-400/5 text-emerald-600 dark:from-emerald-500/20 dark:to-teal-500/5 dark:text-emerald-400",
                        entry.type === "purchase" && "bg-gradient-to-br from-amber-400/10 to-orange-400/5 text-amber-600 dark:from-amber-500/20 dark:to-orange-500/5 dark:text-amber-400",
                        entry.type === "expense" && "bg-gradient-to-br from-rose-400/10 to-red-400/5 text-rose-600 dark:from-rose-500/20 dark:to-red-500/5 dark:text-rose-400",
                        entry.type !== "sale" && entry.type !== "purchase" && entry.type !== "expense" && "bg-gradient-to-br from-blue-400/10 to-indigo-400/5 text-blue-600 dark:from-blue-500/20 dark:to-indigo-500/5 dark:text-blue-400"
                      )}
                    >
                      {entry.type === "sale" && <FileText className="h-4.5 w-4.5" />}
                      {entry.type === "purchase" && <ShoppingCart className="h-4.5 w-4.5" />}
                      {entry.type === "expense" && <Zap className="h-4.5 w-4.5" />}
                      {entry.type !== "sale" && entry.type !== "purchase" && entry.type !== "expense" && <Activity className="h-4.5 w-4.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {entry.partyName || "Cash Counter Sales"}
                        </span>
                        <Badge variant="outline" className="text-[9px] py-0 px-2 h-4.5 uppercase border-gray-200 bg-gray-50/50 text-gray-500 font-mono tracking-tight dark:border-zinc-800 dark:bg-zinc-950">
                          {entry.number}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {new Date(entry.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span
                        className={cn(
                          "text-sm font-bold tracking-tight",
                          isSale ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"
                        )}
                      >
                        {isSale ? "+" : "-"} {formatINR(entry.grandTotal)}
                      </span>
                      <p className="text-[9px] font-bold text-gray-400 capitalize mt-0.5">{entry.type} billing</p>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-gray-400 opacity-0 transition-all duration-300 group-hover/tx:opacity-100 group-hover/tx:translate-x-0.5 dark:bg-zinc-900 dark:text-zinc-500">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

// === 4. Dues, GST, and Stock Warning Center ===
export function DashboardAlerts() {
  const { data: s, isLoading: sLoading } = useQuery<SummaryData>({
    queryKey: ["summary"],
    queryFn: () => api.get<SummaryData>("/api/reports/summary"),
  });

  const { data: outstanding, isLoading: oLoading } = useQuery<OutstandingEntry[]>({
    queryKey: ["outstanding"],
    queryFn: () => api.get<OutstandingEntry[]>("/api/reports/outstanding"),
  });

  const { data: stock, isLoading: kLoading } = useQuery<StockResponse>({
    queryKey: ["stock"],
    queryFn: () => api.get<StockResponse>("/api/reports/stock"),
  });

  const isLoading = sLoading || oLoading || kLoading;

  if (isLoading) {
    return (
      <Card className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-16 w-full mb-3" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  // Split outstanding dues
  const receivablesList = outstanding?.filter(p => p.balance > 0).slice(0, 3) || [];
  const payablesList = outstanding?.filter(p => p.balance < 0).slice(0, 3) || [];

  // Low stock products
  const lowStockProducts = stock?.rows.filter(it => it.low) || [];

  // Accounts Payable/Receivable split sizes
  const totRec = s?.receivables ?? 0;
  const totPay = s?.payables ?? 0;
  const grandDues = totRec + totPay;
  const recRatio = grandDues > 0 ? (totRec / grandDues) * 100 : 50;

  return (
    <div className="space-y-6">
      {/* 4a. Accounts Receivable vs Payable Progress bar */}
      <Card className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-[0_12px_30px_rgba(20,184,166,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-[0_12px_30px_rgba(20,184,166,0.03)]">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Dues & Collections</h3>
        <p className="text-xs text-gray-500 mb-4">Outstanding balance ratio</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 text-xs font-semibold">
            <div>
              <p className="text-gray-400 dark:text-zinc-500">Receivable</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(totRec)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 dark:text-zinc-500">Payable</p>
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatINR(totPay)}</p>
            </div>
          </div>

          <div className="h-4 w-full flex rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-900 shadow-inner">
            {grandDues === 0 ? (
              <div className="h-full w-full bg-gray-200 dark:bg-zinc-800" />
            ) : (
              <>
                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-500" style={{ width: `${recRatio}%` }} />
                <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 shadow-[0_0_8px_rgba(244,63,94,0.3)] transition-all duration-500" style={{ width: `${100 - recRatio}%` }} />
              </>
            )}
          </div>

          {/* Collateral lists of top parties */}
          {receivablesList.length > 0 && (
            <div className="pt-3 border-t border-gray-50 dark:border-zinc-900/60">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                Top Collections
              </h4>
              <div className="space-y-2">
                {receivablesList.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs group/item p-1.5 rounded-xl transition hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-extrabold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-700 dark:text-zinc-300 font-semibold truncate max-w-[150px]">{p.name}</span>
                    </div>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatINR(p.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payablesList.length > 0 && (
            <div className="pt-3 border-t border-gray-50 dark:border-zinc-900/60">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-2">
                Top Dues
              </h4>
              <div className="space-y-2">
                {payablesList.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs group/item p-1.5 rounded-xl transition hover:bg-rose-50/20 dark:hover:bg-rose-950/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[10px] font-extrabold text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-700 dark:text-zinc-300 font-semibold truncate max-w-[150px]">{p.name}</span>
                    </div>
                    <span className="font-extrabold text-rose-600 dark:text-rose-400">{formatINR(Math.abs(p.balance))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 4c. Low Stock Alerts */}
      <Card className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-[0_12px_30px_rgba(20,184,166,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-[0_12px_30px_rgba(20,184,166,0.03)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Stock Level Alerts</h3>
            <p className="text-xs text-gray-500">Products currently below threshold levels</p>
          </div>
          {lowStockProducts.length > 0 && (
            <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-extrabold h-5 px-2 rounded-full shadow-sm animate-pulse">
              {lowStockProducts.length}
            </Badge>
          )}
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-50 bg-gradient-to-br from-emerald-50/30 to-teal-50/10 p-4 dark:border-emerald-950/20 dark:from-emerald-950/5 dark:to-zinc-950/20 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400">All Items Stocked</h4>
              <p className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">No critical shortages identified.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[240px] overflow-y-auto pr-1">
            {lowStockProducts.slice(0, 4).map(it => {
              const pct = it.minStock > 0 ? Math.min((it.qty / it.minStock) * 100, 100) : 0;
              return (
                <div
                  key={it.id}
                  className="group/item flex flex-col justify-between rounded-2xl border border-red-50 bg-red-50/20 p-3.5 transition-all duration-300 hover:bg-red-50/30 dark:border-red-950/10 dark:bg-red-950/5 dark:hover:bg-red-950/10"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate" title={it.name}>
                        {it.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        Threshold: {it.minStock} {it.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-red-600 dark:text-red-400">
                        {it.qty} {it.unit}
                      </span>
                      <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider">Shortage</p>
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-red-100 dark:bg-red-950/20 overflow-hidden shadow-inner">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-gray-400">
                      <span>Stock ratio: {Math.round(pct)}%</span>
                      <span>Critical</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {lowStockProducts.length > 4 && (
              <p className="text-[10px] text-center text-gray-400 dark:text-zinc-500 font-extrabold mt-2 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer transition">
                + {lowStockProducts.length - 4} more items running low
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// === 5. Quick Actions Grid ===
export function QuickActions() {
  const actions = [
    { href: "/invoices", label: "Create Sale", icon: FileText, gradient: "from-emerald-500 to-green-600" },
    { href: "/purchases", label: "Record Purchase", icon: ShoppingCart, gradient: "from-rose-500 to-red-600" },
    { href: "/pos", label: "POS billing", icon: Zap, gradient: "from-amber-400 to-amber-600" },
    { href: "/parties", label: "Add Party", icon: Users, gradient: "from-blue-500 to-indigo-600" },
    { href: "/items", label: "Add Item", icon: Package, gradient: "from-purple-500 to-fuchsia-600" },
  ];

  return (
    <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-base font-bold text-gray-900 dark:text-white">Business Operations Console</h3>
      <p className="text-xs text-gray-500 mb-6">Frequently used billing and logging procedures</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {actions.map(a => (
          <Button
            key={a.href}
            asChild
            variant="outline"
            className="group relative h-auto flex-col gap-3 rounded-2xl border-gray-100 p-5 font-bold transition-all duration-300 hover:-translate-y-0.5 hover:border-transparent hover:shadow-md dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <a href={a.href} className="flex h-full w-full flex-col items-center justify-center">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-110", a.gradient)}>
                <a.icon className="h-5.5 w-5.5" />
              </div>
              <span className="text-xs text-gray-700 dark:text-zinc-300 mt-1">{a.label}</span>
              <span className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </span>
            </a>
          </Button>
        ))}
      </div>
    </Card>
  );
}
