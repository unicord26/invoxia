"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  Users,
  Package,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Percent,
  Activity,
  FileText,
  ShoppingCart,
  Zap,
  Info,
  ExternalLink
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

type GstResponse = {
  output: { taxable: number; cgst: number; sgst: number; igst: number; total: number };
  input: { cgst: number; sgst: number; igst: number; total: number };
  netPayable: number;
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
  icon: any;
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
    queryKey: ["summary"],
    queryFn: () => api.get<SummaryData>("/api/reports/summary"),
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
        label="Active Accounts"
        icon={Users}
        value={`${d?.partiesCount ?? 0}`}
        trend={
          (d?.newPartiesThisWeek ?? 0) > 0
            ? { text: `${d?.newPartiesThisWeek} added this week`, up: true }
            : { text: "No new signups", up: false }
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
  const { data: daybook, isLoading } = useQuery<DaybookEntry[]>({
    queryKey: ["daybook"],
    queryFn: () => api.get<DaybookEntry[]>("/api/reports/daybook"),
  });

  const { data: s } = useQuery<SummaryData>({
    queryKey: ["summary"],
    queryFn: () => api.get<SummaryData>("/api/reports/summary"),
  });

  if (isLoading) {
    return (
      <Card className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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

  const maxVal = Math.max(...displaySales, ...displayExpenses, 10000);
  const chartHeight = 150;
  const scaleY = (v: number) => 170 - (v / maxVal) * chartHeight;
  const scaleX = (idx: number) => 50 + idx * 70;

  const salesPoints = displaySales.map((v, i) => ({ x: scaleX(i), y: scaleY(v) }));
  const expensePoints = displayExpenses.map((v, i) => ({ x: scaleX(i), y: scaleY(v) }));

  // Dynamic SVG Area path generators
  const getAreaD = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]!;
      const curr = pts[i]!;
      const cpX1 = prev.x + 35;
      const cpY1 = prev.y;
      const cpX2 = curr.x - 35;
      const cpY2 = curr.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }
    const lastX = pts[pts.length - 1]!.x;
    d += ` L ${lastX} 170 L ${pts[0]!.x} 170 Z`;
    return d;
  };

  const getLineD = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]!;
      const curr = pts[i]!;
      const cpX1 = prev.x + 35;
      const cpY1 = prev.y;
      const cpX2 = curr.x - 35;
      const cpY2 = curr.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const salesAreaD = getAreaD(salesPoints);
  const salesLineD = getLineD(salesPoints);
  const expenseAreaD = getAreaD(expensePoints);
  const expenseLineD = getLineD(expensePoints);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Dynamic Graph */}
      <Card className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Sales & Expense Trend</h3>
            <p className="text-xs text-gray-500">7-day continuous business flow</p>
          </div>
          {!hasRealData && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-600 hover:bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400">
              Demo Data View
            </Badge>
          )}
          <div className="flex gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Sales (Income)
            </span>
            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              Outflow (Purchases + Expense)
            </span>
          </div>
        </div>

        {/* SVG Graph View */}
        <div className="relative h-[220px] w-full">
          <svg className="h-full w-full" viewBox="0 0 500 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Dotted Grid lines */}
            <line x1="40" y1="170" x2="480" y2="170" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-800" />
            <line x1="40" y1="120" x2="480" y2="120" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-800" />
            <line x1="40" y1="70" x2="480" y2="70" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-800" />
            <line x1="40" y1="20" x2="480" y2="20" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3" className="dark:stroke-zinc-800" />

            {/* Filled Areas */}
            <path d={salesAreaD} fill="url(#salesGrad)" />
            <path d={expenseAreaD} fill="url(#expenseGrad)" />

            {/* Lines */}
            <path d={salesLineD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={expenseLineD} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Glowing vertices */}
            {salesPoints.map((p, idx) => (
              <circle key={`s-dot-${idx}`} cx={p.x} cy={p.y} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" className="shadow-lg" />
            ))}
            {expensePoints.map((p, idx) => (
              <circle key={`e-dot-${idx}`} cx={p.x} cy={p.y} r="4.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" className="shadow-lg" />
            ))}

            {/* X Labels */}
            {labels.map((lbl, idx) => (
              <text key={`lbl-${idx}`} x={scaleX(idx)} y="192" textAnchor="middle" className="fill-gray-400 text-[10px] font-semibold dark:fill-zinc-500">
                {lbl}
              </text>
            ))}

            {/* Y axis indicators */}
            <text x="35" y="24" textAnchor="end" className="fill-gray-400 text-[9px] font-bold dark:fill-zinc-500">
              {formatINR(maxVal, false).split(".")[0]}
            </text>
            <text x="35" y="98" textAnchor="end" className="fill-gray-400 text-[9px] font-bold dark:fill-zinc-500">
              {formatINR(maxVal / 2, false).split(".")[0]}
            </text>
            <text x="35" y="174" textAnchor="end" className="fill-gray-400 text-[9px] font-bold dark:fill-zinc-500">
              0
            </text>
          </svg>
        </div>
      </Card>

      {/* Quick P&L Breakdown Panel */}
      <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Operating Balance</h3>
        <p className="text-xs text-gray-500 mb-6">Net financial breakdown</p>

        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3 dark:border-zinc-900">
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500">Total Sales</p>
              <h4 className="text-lg font-bold text-emerald-600">{formatINR(s?.sales ?? 0)}</h4>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-gray-50 pb-3 dark:border-zinc-900">
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500">Purchases & Expenses</p>
              <h4 className="text-lg font-bold text-rose-600">
                {formatINR((s?.purchases ?? 0) + (s?.expenses ?? 0))}
              </h4>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
              <span>Gross Profit Margin</span>
              <span className="text-purple-600">
                {s?.sales && s.sales > 0 ? `${Math.round((s.grossProfit / s.sales) * 100)}%` : "0%"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600"
                style={{
                  width: `${Math.min(
                    Math.max(s?.sales && s.sales > 0 ? (s.grossProfit / s.sales) * 100 : 0, 0),
                    100
                  )}%`
                }}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
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

  const list = getFiltered().slice(0, 5); // Show top 5 matches

  return (
    <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
          <p className="text-xs text-gray-500">Latest invoices and operational bills logged</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          {(["all", "sale", "purchase", "expense"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition",
                filter === f
                  ? "bg-[#15311f] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              {f === "all" ? "Show All" : f + "s"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by invoice number or party name..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-9 rounded-xl border-gray-200 dark:border-zinc-800 focus-visible:ring-1"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center">
          <Activity className="mx-auto h-8 w-8 text-gray-300 dark:text-zinc-700" />
          <h4 className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-300">No matching activities</h4>
          <p className="text-xs text-gray-400 mt-1">Try tweaking filters or adding new transactions.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-zinc-900">
          {list.map(entry => (
            <div key={entry.id} className="flex items-center justify-between py-3.5 transition hover:bg-gray-50/50 dark:hover:bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs uppercase",
                    entry.type === "sale" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
                    entry.type === "purchase" && "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
                    entry.type === "expense" && "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400",
                    entry.type !== "sale" && entry.type !== "purchase" && entry.type !== "expense" && "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                  )}
                >
                  {entry.type === "sale" && <FileText className="h-4.5 w-4.5" />}
                  {entry.type === "purchase" && <ShoppingCart className="h-4.5 w-4.5" />}
                  {entry.type === "expense" && <Zap className="h-4.5 w-4.5" />}
                  {entry.type !== "sale" && entry.type !== "purchase" && entry.type !== "expense" && <Activity className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {entry.partyName || "Cash Counter Sales"}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4.5 uppercase border-gray-200 text-gray-500 dark:border-zinc-800">
                      {entry.number}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(entry.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "text-sm font-bold",
                    entry.type === "sale" ? "text-emerald-600" : "text-gray-900 dark:text-white"
                  )}
                >
                  {entry.type === "sale" ? "+" : "-"} {formatINR(entry.grandTotal)}
                </span>
                <p className="text-[10px] text-gray-400 capitalize mt-0.5">{entry.type} billing</p>
              </div>
            </div>
          ))}
        </div>
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

  const { data: gst, isLoading: gLoading } = useQuery<GstResponse>({
    queryKey: ["gst"],
    queryFn: () => api.get<GstResponse>("/api/reports/gst"),
  });

  const isLoading = sLoading || oLoading || kLoading || gLoading;

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
      <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Dues & Collections</h3>
        <p className="text-xs text-gray-500 mb-4">Outstanding balance ratio</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 text-xs font-semibold">
            <div>
              <p className="text-gray-400 dark:text-zinc-500">Receivable</p>
              <p className="text-sm font-bold text-emerald-600">{formatINR(totRec)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 dark:text-zinc-500">Payable</p>
              <p className="text-sm font-bold text-rose-600">{formatINR(totPay)}</p>
            </div>
          </div>

          <div className="h-3.5 w-full flex rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-900">
            {grandDues === 0 ? (
              <div className="h-full w-full bg-gray-200 dark:bg-zinc-800" />
            ) : (
              <>
                <div className="h-full bg-emerald-500" style={{ width: `${recRatio}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${100 - recRatio}%` }} />
              </>
            )}
          </div>

          {/* Collateral lists of top parties */}
          {receivablesList.length > 0 && (
            <div className="pt-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                Top Collections
              </h4>
              <div className="space-y-1.5">
                {receivablesList.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs">
                    <span className="text-gray-700 dark:text-zinc-300 font-medium truncate max-w-[150px]">{p.name}</span>
                    <span className="font-bold text-emerald-600">{formatINR(p.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payablesList.length > 0 && (
            <div className="pt-2 border-t border-gray-50 dark:border-zinc-900">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-2">
                Top Dues
              </h4>
              <div className="space-y-1.5">
                {payablesList.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs">
                    <span className="text-gray-700 dark:text-zinc-300 font-medium truncate max-w-[150px]">{p.name}</span>
                    <span className="font-bold text-rose-600">{formatINR(Math.abs(p.balance))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 4b. GST Liabilities Status */}
      <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">GST Status (GSTR-3B)</h3>
        <p className="text-xs text-gray-500 mb-4">Estimated net tax obligation</p>

        <div className="space-y-3.5">
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-500 font-medium">Output Tax (Sales)</span>
            <span className="font-bold text-gray-900 dark:text-white">{formatINR(gst?.output.total ?? 0)}</span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-500 font-medium">Input Tax Credit (ITC)</span>
            <span className="font-bold text-emerald-600">{formatINR(gst?.input.total ?? 0)}</span>
          </div>

          <div className="rounded-xl border border-gray-100 p-3.5 bg-gray-50 dark:border-zinc-900 dark:bg-zinc-900/50">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-gray-400" />
                Net GST Payable
              </span>
              <span className={cn(
                "font-bold text-sm",
                (gst?.netPayable ?? 0) >= 0 ? "text-amber-600" : "text-emerald-600"
              )}>
                {gst?.netPayable && gst.netPayable < 0 ? "Refund/ITC Credit" : formatINR(gst?.netPayable ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              {gst?.netPayable && gst.netPayable < 0
                ? "You have accumulated excess Input Tax Credit to offset future sales."
                : "Tax obligation estimates based on tax configuration setup."}
            </p>
          </div>
        </div>
      </Card>

      {/* 4c. Low Stock Alerts */}
      <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Stock Level Alerts</h3>
            <p className="text-xs text-gray-500">Products currently below threshold levels</p>
          </div>
          {lowStockProducts.length > 0 && (
            <Badge variant="destructive" className="bg-red-500 text-white font-bold h-5 px-2">
              {lowStockProducts.length}
            </Badge>
          )}
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-50 bg-green-50/50 p-4 dark:border-emerald-950/20 dark:bg-emerald-950/10">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-green-800 dark:text-emerald-400">All Items Stocked</h4>
              <p className="text-[11px] text-green-600 mt-0.5">No critical shortages identified.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {lowStockProducts.slice(0, 4).map(it => (
              <div
                key={it.id}
                className="flex items-center justify-between rounded-xl border border-red-50 bg-red-50/30 p-3 dark:border-red-950/25 dark:bg-red-950/10"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate" title={it.name}>
                    {it.name}
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Threshold: {it.minStock} {it.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-red-600">
                    {it.qty} {it.unit}
                  </span>
                  <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Shortage</p>
                </div>
              </div>
            ))}
            {lowStockProducts.length > 4 && (
              <p className="text-[10px] text-center text-gray-400 font-semibold mt-2">
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
