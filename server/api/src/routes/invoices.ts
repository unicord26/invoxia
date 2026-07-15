import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createInvoiceSchema } from "@invoixe/types";
import { computeInvoice } from "@invoixe/core";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { recordStock } from "../lib/stock";

export const invoicesRouter = Router();

// GET /api/invoices — list sale invoices for the user's business
invoicesRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const invoices = await prisma.transaction.findMany({
    where: { businessId, type: "sale", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
  });
  res.json(invoices);
});

// GET /api/invoices/:id — single invoice, scoped to the user's business
invoicesRouter.get("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const invoice = await prisma.transaction.findFirst({
    where: { id: req.params.id, businessId, deletedAt: null },
    include: { party: true, business: true, lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!invoice) return res.status(404).json({ error: "not_found" });
  res.json(invoice);
});

// POST /api/invoices — create a sale invoice (totals computed by the tax engine)
invoicesRouter.post("/", async (req, res) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const businessId = await getUserBusinessId(req.authUser!);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const party = data.partyId
    ? await prisma.party.findFirst({
        where: { id: data.partyId, businessId, deletedAt: null },
      })
    : null;
  if (data.partyId && !party) {
    return res.status(400).json({ error: "party_not_found" });
  }

  const sellerState = business.stateCode ?? "27";
  const buyerState = party?.stateCode ?? sellerState;

  const computed = computeInvoice({
    sellerStateCode: sellerState,
    buyerStateCode: buyerState,
    lines: data.lines.map((l) => ({
      qty: l.qty,
      rate: l.rate,
      taxRate: l.taxRate,
      cessRate: l.cessRate,
      discountPercent: l.discountPercent,
      taxInclusive: l.taxInclusive,
      hsnSac: l.hsnSac ?? undefined,
    })),
    adjustments: {
      discountFlat: data.discountFlat,
      additionalCharges: data.additionalCharges,
      tcsRate: data.tcsRate,
      tdsRate: data.tdsRate,
    },
  });

  const num = await nextNumber(businessId, "sale", "INV");

  const invoice = await prisma.transaction.create({
    data: {
      businessId,
      type: "sale",
      status: "final",
      number: num.number,
      series: num.series,
      seq: num.seq,
      partyId: party?.id ?? null,
      partyName: party?.name ?? null,
      partyGstin: party?.gstin ?? null,
      placeOfSupply: buyerState,
      interState: computed.interState,
      date: data.date ?? new Date(),
      dueDate: data.dueDate ?? null,
      notes: data.notes ?? null,
      subTotal: computed.totals.subTotal,
      totalDiscount: computed.totals.totalDiscount,
      cgst: computed.totals.cgst,
      sgst: computed.totals.sgst,
      igst: computed.totals.igst,
      cess: computed.totals.cess,
      totalTax: computed.totals.totalTax,
      discountFlat: computed.totals.discountFlat,
      additionalCharges: data.additionalCharges.length ? data.additionalCharges : undefined,
      tcsRate: computed.totals.tcsRate,
      tcsAmount: computed.totals.tcsAmount,
      tdsRate: computed.totals.tdsRate,
      tdsAmount: computed.totals.tdsAmount,
      reverseCharge: data.reverseCharge,
      ewayBillNo: data.ewayBillNo ?? null,
      transporterName: data.transporterName ?? null,
      vehicleNo: data.vehicleNo ?? null,
      transportDistanceKm: data.transportDistanceKm ?? null,
      termsConditions: data.termsConditions ?? null,
      roundOff: computed.totals.roundOff,
      grandTotal: computed.totals.grandTotal,
      lines: {
        create: data.lines.map((l, i) => {
          const c = computed.lines[i]!;
          return {
            lineNo: i + 1,
            itemId: l.itemId ?? null,
            description: l.description,
            hsnSac: l.hsnSac ?? null,
            qty: l.qty,
            unit: l.unit,
            rate: l.rate,
            discountPercent: l.discountPercent,
            taxRate: l.taxRate,
            cessRate: l.cessRate,
            taxInclusive: l.taxInclusive,
            taxable: c.taxable,
            cgst: c.cgst,
            sgst: c.sgst,
            igst: c.igst,
            cess: c.cess,
            lineTotal: c.lineTotal,
          };
        }),
      },
    },
    include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
  });

  // Sale reduces stock for product lines.
  await recordStock(businessId, invoice.id, data.lines, -1, "sale");

  res.status(201).json(invoice);
});
