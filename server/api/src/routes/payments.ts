import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createPaymentSchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";

export const paymentsRouter = Router();

// GET /api/payments — list money in/out
paymentsRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const payments = await prisma.transaction.findMany({
    where: { businessId, type: { in: ["payment_in", "payment_out"] }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { party: true },
  });
  res.json(payments);
});

// POST /api/payments — record a payment against a party
paymentsRouter.post("/", async (req, res) => {
  const parsed = createPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const businessId = await getUserBusinessId(req.authUser!);
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, deletedAt: null },
  });
  if (!party) return res.status(400).json({ error: "party_not_found" });

  const prefix = data.type === "payment_in" ? "PAY-IN" : "PAY-OUT";
  const num = await nextNumber(businessId, data.type, prefix);

  const payment = await prisma.transaction.create({
    data: {
      businessId,
      type: data.type,
      status: "final",
      number: num.number,
      series: num.series,
      seq: num.seq,
      partyId: party.id,
      partyName: party.name,
      partyGstin: party.gstin,
      paymentMode: data.paymentMode,
      referenceNo: data.referenceNo ?? null,
      date: data.date ?? new Date(),
      notes: data.notes ?? null,
      subTotal: data.amount,
      grandTotal: data.amount,
    },
    include: { party: true },
  });
  res.status(201).json(payment);
});
