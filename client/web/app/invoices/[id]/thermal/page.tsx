"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@invoixe/core";
import { api } from "../../../../lib/api";

type Line = { lineNo: number; description: string; qty: number; rate: number; lineTotal: number };
type Invoice = {
  number: string; date: string; partyName: string | null;
  subTotal: number; cgst: number; sgst: number; igst: number; roundOff: number; grandTotal: number;
  interState: boolean;
  business: { name: string; gstin: string | null; phone: string | null; address: string | null };
  lines: Line[];
};

export default function ThermalReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: inv, isLoading } = useQuery({ queryKey: ["invoice", id], queryFn: () => api.get<Invoice>(`/api/invoices/${id}`) });

  if (isLoading || !inv) return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  const tax = inv.cgst + inv.sgst + inv.igst;

  return (
    <div className="mx-auto max-w-[420px] px-4 py-6">
      <style>{`
        .rcpt{width:76mm;margin:0 auto;background:#fff;color:#000;font-family:"Courier New",monospace;font-size:11px;padding:4mm}
        .rcpt .c{text-align:center}.rcpt .r{text-align:right}.rcpt .b{font-weight:700}
        .rcpt hr{border:none;border-top:1px dashed #000;margin:4px 0}
        .rcpt table{width:100%}.rcpt td{padding:1px 0;vertical-align:top}
        @media print{.no-print{display:none!important}@page{size:80mm auto;margin:2mm}.rcpt{width:auto}}
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/invoices/${id}`} className="text-sm text-green-700 hover:underline">← A4 view</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Print receipt</button>
      </div>

      <div className="rcpt border border-gray-200">
        <div className="c b" style={{ fontSize: 14 }}>{inv.business.name}</div>
        {inv.business.address && <div className="c">{inv.business.address}</div>}
        {inv.business.phone && <div className="c">Ph: {inv.business.phone}</div>}
        {inv.business.gstin && <div className="c">GSTIN: {inv.business.gstin}</div>}
        <hr />
        <div>Bill: {inv.number}</div>
        <div>Date: {new Date(inv.date).toLocaleString("en-IN")}</div>
        <div>To: {inv.partyName ?? "Cash"}</div>
        <hr />
        <table>
          <tbody>
            <tr className="b"><td>Item</td><td className="r">Qty</td><td className="r">Rate</td><td className="r">Amt</td></tr>
            {inv.lines.map((l) => (
              <tr key={l.lineNo}>
                <td>{l.description.slice(0, 16)}</td>
                <td className="r">{l.qty}</td>
                <td className="r">{formatINR(l.rate, false)}</td>
                <td className="r">{formatINR(l.lineTotal, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <table>
          <tbody>
            <tr><td>Sub Total</td><td className="r">{formatINR(inv.subTotal, false)}</td></tr>
            {inv.interState
              ? <tr><td>IGST</td><td className="r">{formatINR(inv.igst, false)}</td></tr>
              : <><tr><td>CGST</td><td className="r">{formatINR(inv.cgst, false)}</td></tr><tr><td>SGST</td><td className="r">{formatINR(inv.sgst, false)}</td></tr></>}
            {inv.roundOff !== 0 && <tr><td>Round Off</td><td className="r">{formatINR(inv.roundOff, false)}</td></tr>}
            <tr className="b" style={{ fontSize: 13 }}><td>TOTAL</td><td className="r">{formatINR(inv.grandTotal, false)}</td></tr>
          </tbody>
        </table>
        <hr />
        <div className="c">Tax: {formatINR(tax)}</div>
        <div className="c b" style={{ marginTop: 4 }}>Thank you! Visit again</div>
      </div>
    </div>
  );
}
