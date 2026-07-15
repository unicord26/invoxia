import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createExpenseSchema } from "@invoixe/types";
import { computeLine } from "@invoixe/core";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";

export const expensesRouter = Router();

// GET /api/expenses
expensesRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const expenses = await prisma.transaction.findMany({
    where: { businessId, type: "expense", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { party: true },
  });
  res.json(expenses);
});

// POST /api/expenses — amount is treated as tax-inclusive total
expensesRouter.post("/", async (req, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const businessId = await getUserBusinessId(req.authUser!);
  const party = data.partyId
    ? await prisma.party.findFirst({ where: { id: data.partyId, businessId, deletedAt: null } })
    : null;

  // Back out input GST from the inclusive amount (intra-state assumption for expenses).
  const c = computeLine(
    { qty: 1, rate: data.amount, taxRate: data.taxRate, taxInclusive: true },
    false
  );

  const num = await nextNumber(businessId, "expense", "EXP");

  const expense = await prisma.transaction.create({
    data: {
      businessId, type: "expense", status: "final",
      number: num.number, series: num.series, seq: num.seq,
      partyId: party?.id ?? null, partyName: party?.name ?? null,
      category: data.category, paymentMode: data.paymentMode,
      date: data.date ?? new Date(), notes: data.notes ?? null,
      subTotal: c.taxable, cgst: c.cgst, sgst: c.sgst, cess: c.cess,
      totalTax: c.totalTax, grandTotal: data.amount,
    },
    include: { party: true },
  });
  res.status(201).json(expense);
});
