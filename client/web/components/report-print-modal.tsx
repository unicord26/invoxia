"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X, FileText } from "lucide-react";
import { formatINR } from "@invoixe/core";

export type ReportPrintData = {
  reportType: "pnl" | "bnt";
  title: string;
  periodLabel: string;
  summary: {
    totalSales?: number;
    totalPurchases?: number;
    totalExpenses?: number;
    grossProfit?: number;
    netProfit?: number;
    profitMarginPct?: string;
    totalReceivables?: number;
    totalPayables?: number;
    netGstPayable?: number;
    totalStockVal?: number;
  };
  tables: {
    sales?: Array<{ number: string; date: string; partyName?: string | null; paymentMode?: string | null; grandTotal: number }>;
    purchases?: Array<{ number: string; date: string; partyName?: string | null; paymentMode?: string | null; grandTotal: number }>;
    expenses?: Array<{ number: string; date: string; category?: string | null; paymentMode?: string | null; grandTotal: number }>;
    receivables?: Array<{ name: string; phone?: string | null; balance: number }>;
    payables?: Array<{ name: string; phone?: string | null; balance: number }>;
    stock?: Array<{ name: string; itemCode?: string | null; categoryName?: string; qty: number; unit: string; value: number }>;
  };
};

type ReportPrintModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReportPrintData | null;
};

function fmtDate(d?: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ReportPrintModal({ open, onOpenChange, data }: ReportPrintModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Esc key listener to close modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) {
      window.addEventListener("keydown", onKey);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !data) return null;

  const currentDateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleTriggerPrint = () => {
    window.print();
  };

  // The actual printable report element (used in modal preview & portal)
  const reportSheetNode = (
    <div id="printable-report-sheet" className="font-sans text-xs space-y-6 bg-white text-zinc-900">
      {/* Document Header */}
      <div className="flex justify-between items-end border-b-2 border-zinc-900 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-zinc-900">{data.title}</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">Internal Financial Summary Report • Prepared by Invoixe</p>
        </div>

        <div className="text-right text-[11px] font-mono text-zinc-600 space-y-0.5">
          <div>Period: <strong>{data.periodLabel}</strong></div>
          <div>Date: <strong>{currentDateStr}</strong></div>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="space-y-2 print-keep">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
          Summary Overview
        </h2>

        {data.reportType === "pnl" ? (
          <div className="grid grid-cols-4 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
            <div className="border-r border-zinc-200 pr-2">
              <p className="text-[10px] font-medium text-zinc-500">Total Sales</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.totalSales ?? 0)}</p>
            </div>
            <div className="border-r border-zinc-200 pr-2">
              <p className="text-[10px] font-medium text-zinc-500">Total Purchases</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.totalPurchases ?? 0)}</p>
            </div>
            <div className="border-r border-zinc-200 pr-2">
              <p className="text-[10px] font-medium text-zinc-500">Total Expenses</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.totalExpenses ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-500">Net Profit</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">
                {formatINR(data.summary.netProfit ?? 0)}
              </p>
              <span className="text-[10px] font-semibold text-zinc-600 block">
                ({data.summary.profitMarginPct ?? "0.0"}% Margin)
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
            <div className="border-r border-zinc-200 pr-2">
              <p className="text-[10px] font-medium text-zinc-500">Receivables</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.totalReceivables ?? 0)}</p>
            </div>
            <div className="border-r border-zinc-200 pr-2">
              <p className="text-[10px] font-medium text-zinc-500">Payables</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.totalPayables ?? 0)}</p>
            </div>
            <div className="border-r border-zinc-200 pr-2">
              <p className="text-[10px] font-medium text-zinc-500">Net GST Tax</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.netGstPayable ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-zinc-500">Stock Value</p>
              <p className="text-base font-bold text-zinc-900 font-mono mt-0.5">{formatINR(data.summary.totalStockVal ?? 0)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sales Table */}
      {data.tables.sales && data.tables.sales.length > 0 && (
        <div className="space-y-2 print-keep">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Sales Transactions ({data.tables.sales.length})
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-zinc-200 rounded-lg overflow-hidden">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-200 w-8 text-center">#</th>
                <th className="py-2 px-3 border-r border-zinc-200">Invoice #</th>
                <th className="py-2 px-3 border-r border-zinc-200">Date</th>
                <th className="py-2 px-3 border-r border-zinc-200">Customer Name</th>
                <th className="py-2 px-3 border-r border-zinc-200">Payment Mode</th>
                <th className="py-2 px-3 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.tables.sales.map((s, idx) => (
                <tr key={idx} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 border-r border-zinc-200 text-center font-mono text-[10px] text-zinc-400">{idx + 1}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-mono font-bold">{s.number}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{fmtDate(s.date)}</td>
                  <td className="py-2 px-3 border-r border-zinc-200">{s.partyName || "Cash Sale"}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{s.paymentMode || "Cash"}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatINR(s.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchases Table */}
      {data.tables.purchases && data.tables.purchases.length > 0 && (
        <div className="space-y-2 print-keep">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Purchases Transactions ({data.tables.purchases.length})
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-zinc-200 rounded-lg overflow-hidden">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-200 w-8 text-center">#</th>
                <th className="py-2 px-3 border-r border-zinc-200">Bill #</th>
                <th className="py-2 px-3 border-r border-zinc-200">Date</th>
                <th className="py-2 px-3 border-r border-zinc-200">Supplier Name</th>
                <th className="py-2 px-3 border-r border-zinc-200">Payment Mode</th>
                <th className="py-2 px-3 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.tables.purchases.map((p, idx) => (
                <tr key={idx} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 border-r border-zinc-200 text-center font-mono text-[10px] text-zinc-400">{idx + 1}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-mono font-bold">{p.number}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{fmtDate(p.date)}</td>
                  <td className="py-2 px-3 border-r border-zinc-200">{p.partyName || "Direct Purchase"}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{p.paymentMode || "Bank"}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatINR(p.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expenses Table */}
      {data.tables.expenses && data.tables.expenses.length > 0 && (
        <div className="space-y-2 print-keep">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Operating Expenses ({data.tables.expenses.length})
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-zinc-200 rounded-lg overflow-hidden">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-200 w-8 text-center">#</th>
                <th className="py-2 px-3 border-r border-zinc-200">Expense Ref.</th>
                <th className="py-2 px-3 border-r border-zinc-200">Date</th>
                <th className="py-2 px-3 border-r border-zinc-200">Category</th>
                <th className="py-2 px-3 border-r border-zinc-200">Payment Mode</th>
                <th className="py-2 px-3 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.tables.expenses.map((e, idx) => (
                <tr key={idx} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 border-r border-zinc-200 text-center font-mono text-[10px] text-zinc-400">{idx + 1}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-mono font-bold">{e.number}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{fmtDate(e.date)}</td>
                  <td className="py-2 px-3 border-r border-zinc-200">{e.category || "General"}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{e.paymentMode || "Cash"}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatINR(e.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Debtors Table */}
      {data.tables.receivables && data.tables.receivables.length > 0 && (
        <div className="space-y-2 print-keep">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Customer Debtors ({data.tables.receivables.length})
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-zinc-200 rounded-lg overflow-hidden">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-200 w-8 text-center">#</th>
                <th className="py-2 px-3 border-r border-zinc-200">Customer Name</th>
                <th className="py-2 px-3 border-r border-zinc-200">Phone</th>
                <th className="py-2 px-3 text-right">Balance (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.tables.receivables.map((r, idx) => (
                <tr key={idx} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 border-r border-zinc-200 text-center font-mono text-[10px] text-zinc-400">{idx + 1}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-bold">{r.name}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{r.phone || "—"}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatINR(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier Creditors Table */}
      {data.tables.payables && data.tables.payables.length > 0 && (
        <div className="space-y-2 print-keep">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            Supplier Creditors ({data.tables.payables.length})
          </h3>
          <table className="w-full text-left text-[11px] border-collapse border border-zinc-200 rounded-lg overflow-hidden">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[9px]">
              <tr>
                <th className="py-2 px-3 border-r border-zinc-200 w-8 text-center">#</th>
                <th className="py-2 px-3 border-r border-zinc-200">Supplier Name</th>
                <th className="py-2 px-3 border-r border-zinc-200">Phone</th>
                <th className="py-2 px-3 text-right">Balance (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.tables.payables.map((p, idx) => (
                <tr key={idx} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 border-r border-zinc-200 text-center font-mono text-[10px] text-zinc-400">{idx + 1}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 font-bold">{p.name}</td>
                  <td className="py-2 px-3 border-r border-zinc-200 text-zinc-600">{p.phone || "—"}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatINR(p.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clean Centered Signatory Section */}
      <div className="flex justify-between items-end pt-10 border-t border-zinc-200 text-[11px] print-keep">
        {/* Left: Invoixe above line, Prepared By below line */}
        <div className="w-48 text-center">
          <p className="font-bold text-zinc-850 text-[11px] font-mono pb-1">Invoixe</p>
          <div className="w-full border-b border-zinc-400 mb-1.5" />
          <p className="font-bold text-zinc-900">Prepared By</p>
        </div>

        {/* Right: Blank space above line, Authorized By below line */}
        <div className="w-48 text-center">
          <div className="h-5" />
          <div className="w-full border-b border-zinc-400 mb-1.5" />
          <p className="font-bold text-zinc-900">Authorized By</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Screen Modal Preview Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/75 backdrop-blur-sm z-50 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto print:hidden"
        onClick={() => onOpenChange(false)}
      >
        {/* Top Modal Controls Header */}
        <div
          className="w-full max-w-[210mm] bg-zinc-900 text-white rounded-t-2xl p-4 flex items-center justify-between shadow-2xl shrink-0 border-b border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-200 flex items-center justify-center border border-zinc-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white">{data.title}</h3>
              <p className="text-[11px] text-zinc-400">Internal Financial Summary • Prepared by Invoixe</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerPrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal On-Screen Document Sheet */}
        <div
          className="w-full max-w-[210mm] bg-white text-zinc-900 rounded-b-2xl shadow-2xl p-8 sm:p-12 space-y-6"
          onClick={(e) => e.stopPropagation()}
        >
          {reportSheetNode}
        </div>
      </div>

      {/* 2. Direct Body Portal for Clean Print Output (Zero Blank Pages) */}
      {mounted &&
        createPortal(
          <div id="print-container" className="hidden print:block bg-white text-zinc-900 p-0 m-0">
            {reportSheetNode}
          </div>,
          document.body
        )}

      {/* Global CSS for Bulletproof Print Output */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important; /* Force browser default double margins to 0 */
          }

          /* Hide everything under body EXCEPT #print-container */
          body > *:not(#print-container) {
            display: none !important;
          }

          /* Render ONLY #print-container with fixed A4 width and internal margins */
          #print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            padding: 15mm 20mm !important; /* Safe printable margins on A4 paper */
            background: white !important;
            color: black !important;
          }

          #printable-report-sheet {
            width: 100% !important;
            background: white !important;
          }

          .print-keep {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </>
  );
}
