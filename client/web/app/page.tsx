"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ArrowRight, RefreshCw, Layers } from "lucide-react";
import {
  DashboardKPIs,
  DashboardCharts,
  DashboardActivity,
  DashboardAlerts,
  QuickActions
} from "../components/DashboardMetrics";
import { flattenLeaves } from "../lib/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Home() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) setGreeting("Good Morning");
    else if (hrs < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["summary"] }),
      queryClient.invalidateQueries({ queryKey: ["daybook"] }),
      queryClient.invalidateQueries({ queryKey: ["gst"] }),
      queryClient.invalidateQueries({ queryKey: ["stock"] }),
      queryClient.invalidateQueries({ queryKey: ["outstanding"] })
    ]);
    setTimeout(() => {
      setRefreshing(false);
      toast.success("Dashboard metrics refreshed successfully!");
    }, 500);
  };

  // Operational modules for quick navigation
  const modules = flattenLeaves().filter((m) => m.href !== "/");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Header / Welcome Area */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-6 md:flex-row md:items-center dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {greeting}, User
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and administer your business accounts and GST filings in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 gap-2 rounded-xl text-gray-500 border-gray-200 dark:border-zinc-800 dark:text-zinc-400"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {/* Real-time date display */}
          <div className="flex h-9 items-center gap-2 rounded-xl bg-gray-100 px-4 text-xs font-bold text-gray-500 dark:bg-zinc-900 dark:text-zinc-400">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            {today}
          </div>
        </div>
      </div>

      {/* 2. Key Performance Indicators */}
      <DashboardKPIs />

      {/* 3. Primary Actions Console */}
      <QuickActions />

      {/* 4. Core Analytics Grid (2/3 & 1/3 splits) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Span: Sales Chart + Activity ledger */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardCharts />
          <DashboardActivity />
        </div>

        {/* Right Span: Financial health status checks & alerts */}
        <div className="lg:col-span-1">
          <DashboardAlerts />
        </div>
      </div>

      {/* 5. System Directory / Operational Modules Grid */}
      <div className="pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-4.5 w-4.5 text-gray-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-zinc-400">
            System Operations Shelf
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="group">
              <Card className="flex h-full min-h-[90px] flex-col justify-between rounded-xl border border-gray-100 shadow-sm transition hover:border-[#16a34a]/30 hover:shadow dark:border-zinc-800 dark:hover:border-[#16a34a]/30 dark:bg-zinc-950">
                <CardContent className="flex h-full flex-col justify-between p-4">
                  <div className="flex items-center gap-2">
                    {m.icon && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400">
                        <m.icon className="h-4 w-4" />
                      </span>
                    )}
                    <h4 className="text-[12px] font-bold tracking-tight text-gray-900 truncate dark:text-white" title={m.label}>
                      {m.label}
                    </h4>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-gray-400 transition group-hover:text-green-600">
                    <span>Manage Module</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
