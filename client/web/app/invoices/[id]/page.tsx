"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatINR, inWordsINR } from "@invoixe/core";
import type { BusinessSettings } from "@invoixe/types";
import { api } from "../../../lib/api";

type Line = {
  lineNo: number;
  description: string;
  hsnSac: string | null;
  qty: number;
  unit: string;
  rate: number;
  taxRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  lineTotal: number;
};
type Business = {
  name: string; gstin: string | null; pan: string | null; address: string | null;
  phone: string | null; email: string | null; stateCode: string | null; jurisdiction: string | null;
  bankName: string | null; bankAccountNo: string | null; bankIfsc: string | null; bankBranch: string | null;
  logoUrl: string | null; signatureUrl: string | null;
};
type Invoice = {
  number: string; date: string; dueDate: string | null; placeOfSupply: string | null;
  interState: boolean; partyName: string | null; partyGstin: string | null;
  subTotal: number; totalDiscount: number; cgst: number; sgst: number; igst: number; cess: number;
  roundOff: number; grandTotal: number;
  // Phase F extras
  discountFlat: number; additionalCharges: { label: string; amount: number }[] | null;
  tcsRate: number; tcsAmount: number; tdsRate: number; tdsAmount: number;
  reverseCharge: boolean; ewayBillNo: string | null; transporterName: string | null;
  vehicleNo: string | null; transportDistanceKm: number | null; termsConditions: string | null;
  business: Business;
  party: { name: string; gstin: string | null; billingAddress: string | null; stateCode: string | null } | null;
  lines: Line[];
};

export default function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: inv, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<Invoice>(`/api/invoices/${id}`),
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<BusinessSettings>("/api/business/current/settings"),
  });

  if (isLoading) return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  if (error || !inv) return <p className="p-8 text-sm text-red-600">Invoice not found.</p>;

  // Print toggles — default everything ON until settings load (avoids a flash of
  // hidden fields). `theme` drives the layout density.
  const P = settings?.print;
  const show = {
    logo: P?.showLogo ?? true,
    gstin: P?.showGstinOnSale ?? true,
    taxDetails: P?.showTaxDetails ?? true,
    amountInWords: P?.showAmountInWords ?? true,
    signature: P?.showSignature ?? true,
  };
  const theme = P?.theme ?? "tally";
  const charges = inv.additionalCharges ?? [];

  const rates = [...new Set(inv.lines.map((l) => l.taxRate))];
  const uniformRate = rates.length === 1 ? rates[0]! : null;

  // HSN/SAC summary grouped by code + rate
  const hsnMap = new Map<string, { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const l of inv.lines) {
    const key = `${l.hsnSac ?? "-"}|${l.taxRate}`;
    const e = hsnMap.get(key) ?? { hsn: l.hsnSac ?? "-", rate: l.taxRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    e.taxable += l.taxable; e.cgst += l.cgst; e.sgst += l.sgst; e.igst += l.igst;
    hsnMap.set(key, e);
  }
  const hsnRows = [...hsnMap.values()];
  const taxTotal = inv.cgst + inv.sgst + inv.igst + inv.cess;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6">
      <style>{`
        .inv table{width:100%;border-collapse:collapse}
        .inv .frame,.inv .frame td,.inv .frame th{border:1px solid #111}
        .inv td,.inv th{padding:4px 6px;vertical-align:top;font-size:12px}
        .inv .r{text-align:right}.inv .c{text-align:center}.inv .b{font-weight:700}
        .inv .mut{color:#6b7280;font-size:10px}
        .inv thead.items th{background:#16a34a;color:#fff;font-size:11px}
        .inv .grand td{background:#f0fdf4;font-weight:800;font-size:13px}
        /* gst1 = spacious GST theme: larger type + roomier cells */
        .inv.gst1 td,.inv.gst1 th{padding:7px 9px;font-size:13px}
        .inv.gst1 .grand td{font-size:15px}
        .inv.gst1 thead.items th{font-size:12px}
        @media print{.no-print{display:none!important}.inv{margin:0}@page{size:A4;margin:8mm}}
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/invoices" className="text-sm text-green-700 hover:underline">← Invoices</Link>
        <div className="flex items-center gap-2">
          <Link href={`/invoices/${id}/thermal`} className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
            Thermal
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className={`inv bg-white p-4 ${theme}`}>
        <table className="frame">
          <tbody>
            <tr style={{ background: "#f0fdf4" }}>
              <td colSpan={2} className="b" style={{ color: "#15803d", fontSize: 15 }}>TAX INVOICE</td>
              <td colSpan={2} className="r b">Original for Buyer</td>
            </tr>
            <tr>
              <td colSpan={2}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {show.logo && inv.business.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={inv.business.logoUrl} alt="" style={{ height: 48, width: 48, objectFit: "contain" }} />
                  )}
                  <div>
                    <div className="b" style={{ fontSize: 18, color: "#15803d" }}>{inv.business.name}</div>
                    {inv.business.address && <div className="mut">{inv.business.address}</div>}
                  </div>
                </div>
                {show.gstin && inv.business.gstin && <div style={{ fontSize: 11 }} className="b">GSTIN/UIN: {inv.business.gstin}</div>}
                {inv.business.phone && <div style={{ fontSize: 11 }}>Contact: {inv.business.phone}</div>}
                {inv.business.email && <div style={{ fontSize: 11 }}>Email: {inv.business.email}</div>}
              </td>
              <td colSpan={2} style={{ padding: 0 }}>
                <table className="frame" style={{ height: "100%" }}>
                  <tbody>
                    <tr><td><span className="mut">Invoice No.</span><br /><span className="b">{inv.number}</span></td>
                        <td><span className="mut">Dated</span><br /><span className="b">{new Date(inv.date).toLocaleDateString("en-IN")}</span></td></tr>
                    <tr><td><span className="mut">Place of Supply</span><br />{inv.placeOfSupply ?? "—"}</td>
                        <td><span className="mut">Due Date</span><br />{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}</td></tr>
                    <tr><td><span className="mut">Supply Type</span><br />{inv.interState ? "Inter-state" : "Intra-state"}</td>
                        <td><span className="mut">State Code</span><br />{inv.business.stateCode ?? "—"}</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td colSpan={4}>
                <span className="mut">Name &amp; Address of Consignee (Bill to):</span><br />
                <span className="b">{inv.party?.name ?? inv.partyName ?? "Cash Sale"}</span>
                {inv.party?.billingAddress && <div style={{ fontSize: 11 }}>{inv.party.billingAddress}</div>}
                {(inv.party?.gstin ?? inv.partyGstin) && (
                  <div style={{ fontSize: 11 }} className="b">GSTIN/UIN: {inv.party?.gstin ?? inv.partyGstin}</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* line items */}
        <table className="frame" style={{ borderTop: "none" }}>
          <thead className="items">
            <tr>
              <th style={{ width: 34 }}>SR</th>
              <th>Description of Goods</th>
              <th style={{ width: 80 }}>HSN/SAC</th>
              <th style={{ width: 64 }}>Qty</th>
              <th style={{ width: 74 }} className="r">Rate</th>
              <th style={{ width: 44 }}>Per</th>
              <th style={{ width: 96 }} className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.lineNo}>
                <td className="c">{l.lineNo}</td>
                <td>{l.description}</td>
                <td className="c">{l.hsnSac ?? "—"}</td>
                <td className="c">{l.qty}</td>
                <td className="r">{formatINR(l.rate, false)}</td>
                <td className="c">{l.unit}</td>
                <td className="r">{formatINR(l.taxable, false)}</td>
              </tr>
            ))}
            {/* totals */}
            <tr><td colSpan={6} className="r b">Total</td><td className="r b">{formatINR(inv.subTotal, false)}</td></tr>
            {!inv.interState && <tr><td colSpan={6} className="r">Output CGST{uniformRate != null ? ` @ ${uniformRate / 2}%` : ""}</td><td className="r">{formatINR(inv.cgst, false)}</td></tr>}
            {!inv.interState && <tr><td colSpan={6} className="r">Output SGST{uniformRate != null ? ` @ ${uniformRate / 2}%` : ""}</td><td className="r">{formatINR(inv.sgst, false)}</td></tr>}
            {inv.interState && <tr><td colSpan={6} className="r">Output IGST{uniformRate != null ? ` @ ${uniformRate}%` : ""}</td><td className="r">{formatINR(inv.igst, false)}</td></tr>}
            {inv.discountFlat > 0 && <tr><td colSpan={6} className="r">Less: Discount</td><td className="r">− {formatINR(inv.discountFlat, false)}</td></tr>}
            {charges.map((c, i) => (
              <tr key={`ch-${i}`}><td colSpan={6} className="r">Add: {c.label}</td><td className="r">{formatINR(c.amount, false)}</td></tr>
            ))}
            {inv.tcsAmount > 0 && <tr><td colSpan={6} className="r">Add: TCS @ {inv.tcsRate}%</td><td className="r">{formatINR(inv.tcsAmount, false)}</td></tr>}
            {inv.tdsAmount > 0 && <tr><td colSpan={6} className="r">Less: TDS @ {inv.tdsRate}%</td><td className="r">− {formatINR(inv.tdsAmount, false)}</td></tr>}
            {inv.roundOff !== 0 && <tr><td colSpan={6} className="r">Round Off</td><td className="r">{formatINR(inv.roundOff, false)}</td></tr>}
            <tr className="grand"><td colSpan={6} className="r">Grand Total</td><td className="r">₹ {formatINR(inv.grandTotal, false)}</td></tr>
          </tbody>
        </table>

        {show.amountInWords && (
          <table className="frame" style={{ borderTop: "none" }}>
            <tbody><tr><td><span className="mut">Amount (in words):</span> <span className="b" style={{ fontStyle: "italic" }}>{inWordsINR(inv.grandTotal)}</span></td></tr></tbody>
          </table>
        )}

        {/* HSN summary */}
        {show.taxDetails && (
        <table className="frame" style={{ borderTop: "none" }}>
          <thead className="items">
            <tr>
              <th>HSN/SAC</th><th className="r">Taxable</th>
              <th className="c">Rate</th><th className="r">CGST</th>
              <th className="c">Rate</th><th className="r">SGST</th>
              <th className="r">IGST</th>
            </tr>
          </thead>
          <tbody>
            {hsnRows.map((h, i) => (
              <tr key={i}>
                <td>{h.hsn}</td><td className="r">{formatINR(h.taxable, false)}</td>
                <td className="c">{inv.interState ? "-" : `${h.rate / 2}%`}</td><td className="r">{formatINR(h.cgst, false)}</td>
                <td className="c">{inv.interState ? "-" : `${h.rate / 2}%`}</td><td className="r">{formatINR(h.sgst, false)}</td>
                <td className="r">{formatINR(h.igst, false)}</td>
              </tr>
            ))}
            <tr className="b">
              <td className="r">TOTAL</td><td className="r">{formatINR(inv.subTotal, false)}</td>
              <td></td><td className="r">{formatINR(inv.cgst, false)}</td>
              <td></td><td className="r">{formatINR(inv.sgst, false)}</td>
              <td className="r">{formatINR(inv.igst, false)}</td>
            </tr>
          </tbody>
        </table>
        )}

        {/* transport / e-way + terms */}
        {(inv.ewayBillNo || inv.transporterName || inv.vehicleNo || inv.transportDistanceKm || inv.reverseCharge) && (
          <table className="frame" style={{ borderTop: "none" }}>
            <tbody>
              <tr>
                <td>
                  {inv.ewayBillNo && <span style={{ fontSize: 11, marginRight: 12 }}><span className="mut">E-Way Bill:</span> <span className="b">{inv.ewayBillNo}</span></span>}
                  {inv.transporterName && <span style={{ fontSize: 11, marginRight: 12 }}><span className="mut">Transporter:</span> {inv.transporterName}</span>}
                  {inv.vehicleNo && <span style={{ fontSize: 11, marginRight: 12 }}><span className="mut">Vehicle:</span> {inv.vehicleNo}</span>}
                  {inv.transportDistanceKm != null && <span style={{ fontSize: 11, marginRight: 12 }}><span className="mut">Distance:</span> {inv.transportDistanceKm} km</span>}
                  {inv.reverseCharge && <span style={{ fontSize: 11 }} className="b">Reverse charge applicable</span>}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {inv.termsConditions && (
          <table className="frame" style={{ borderTop: "none" }}>
            <tbody><tr><td><div className="mut">Terms &amp; Conditions</div><div style={{ fontSize: 10, whiteSpace: "pre-line" }}>{inv.termsConditions}</div></td></tr></tbody>
          </table>
        )}

        {/* footer */}
        <table className="frame" style={{ borderTop: "none" }}>
          <tbody>
            <tr>
              <td style={{ width: "58%" }}>
                {inv.business.pan && <div className="b" style={{ fontSize: 11 }}>Company's PAN: {inv.business.pan}</div>}
                {(inv.business.bankName || inv.business.bankAccountNo) && (
                  <div style={{ marginTop: 6 }}>
                    <div className="mut">Company's Bank Details</div>
                    {inv.business.bankName && <div style={{ fontSize: 11 }}>Bank: <span className="b">{inv.business.bankName}</span></div>}
                    {inv.business.bankAccountNo && <div style={{ fontSize: 11 }}>A/c No.: {inv.business.bankAccountNo}</div>}
                    {inv.business.bankIfsc && <div style={{ fontSize: 11 }}>IFSC: {inv.business.bankIfsc}</div>}
                    {inv.business.bankBranch && <div style={{ fontSize: 11 }}>Branch: {inv.business.bankBranch}</div>}
                  </div>
                )}
                <div className="mut" style={{ marginTop: 6 }}>Declaration</div>
                <div style={{ fontSize: 9, lineHeight: 1.35 }}>
                  Goods once sold will not be taken back. Interest @18% p.a. will be charged on overdue payments.
                  Our risk &amp; responsibility ceases as soon as goods leave our premises.
                </div>
                <div className="mut" style={{ marginTop: 8, fontSize: 9 }}>Total tax: {formatINR(taxTotal)}</div>
              </td>
              <td style={{ width: "42%", verticalAlign: "bottom" }}>
                <div className="r b" style={{ color: "#15803d" }}>for {inv.business.name}</div>
                {show.signature && inv.business.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div style={{ textAlign: "right", marginTop: 4 }}>
                    <img src={inv.business.signatureUrl} alt="" style={{ height: 44, objectFit: "contain", display: "inline-block" }} />
                  </div>
                ) : (
                  <div style={{ marginTop: 28 }} />
                )}
                <div className="r mut">Authorised Signatory</div>
              </td>
            </tr>
            <tr>
              <td className="c mut" style={{ fontSize: 10 }}>This is a computer generated invoice.</td>
              <td className="c b" style={{ fontSize: 10 }}>Subject to {inv.business.jurisdiction ?? "local"} Jurisdiction</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
