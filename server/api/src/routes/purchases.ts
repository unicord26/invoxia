import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createPurchaseSchema } from "@invoixe/types";
import { computeInvoice } from "@invoixe/core";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { recordStock } from "../lib/stock";

export const purchasesRouter = Router();

// GET /api/purchases
purchasesRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const purchases = await prisma.transaction.findMany({
    where: { businessId, type: "purchase", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
  });
  res.json(purchases);
});

// GET /api/purchases/:id
purchasesRouter.get("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const purchase = await prisma.transaction.findFirst({
    where: { id: req.params.id, businessId, deletedAt: null },
    include: { party: true, business: true, lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!purchase) return res.status(404).json({ error: "not_found" });
  res.json(purchase);
});

// POST /api/purchases — supplier bill (input GST). Supplier is the "seller".
purchasesRouter.post("/", async (req, res) => {
  const parsed = createPurchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const businessId = await getUserBusinessId(req.authUser!);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const party = data.partyId
    ? await prisma.party.findFirst({ where: { id: data.partyId, businessId, deletedAt: null } })
    : null;
  if (data.partyId && !party) return res.status(400).json({ error: "party_not_found" });

  const buyerState = business.stateCode ?? "27";
  const sellerState = party?.stateCode ?? buyerState;

  const computed = computeInvoice({
    sellerStateCode: sellerState,
    buyerStateCode: buyerState,
    lines: data.lines.map((l) => ({
      qty: l.qty, rate: l.rate, taxRate: l.taxRate, cessRate: l.cessRate,
      discountPercent: l.discountPercent, taxInclusive: l.taxInclusive, hsnSac: l.hsnSac ?? undefined,
    })),
  });

  const num = await nextNumber(businessId, "purchase", "PUR");

  const purchase = await prisma.transaction.create({
    data: {
      businessId, type: "purchase", status: "final",
      number: num.number, series: num.series, seq: num.seq,
      partyId: party?.id ?? null, partyName: party?.name ?? null, partyGstin: party?.gstin ?? null,
      placeOfSupply: sellerState, interState: computed.interState,
      referenceNo: data.referenceNo ?? null,
      date: data.date ?? new Date(), dueDate: data.dueDate ?? null, notes: data.notes ?? null,
      subTotal: computed.totals.subTotal, totalDiscount: computed.totals.totalDiscount,
      cgst: computed.totals.cgst, sgst: computed.totals.sgst, igst: computed.totals.igst,
      cess: computed.totals.cess, totalTax: computed.totals.totalTax,
      roundOff: computed.totals.roundOff, grandTotal: computed.totals.grandTotal,
      lines: {
        create: data.lines.map((l, i) => {
          const c = computed.lines[i]!;
          return {
            lineNo: i + 1, itemId: l.itemId ?? null, description: l.description, hsnSac: l.hsnSac ?? null,
            qty: l.qty, unit: l.unit, rate: l.rate, discountPercent: l.discountPercent,
            taxRate: l.taxRate, cessRate: l.cessRate, taxInclusive: l.taxInclusive,
            taxable: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, cess: c.cess, lineTotal: c.lineTotal,
          };
        }),
      },
    },
    include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
  });

  // Purchase increases stock for product lines.
  await recordStock(businessId, purchase.id, data.lines, 1, "purchase");

  res.status(201).json(purchase);
});
