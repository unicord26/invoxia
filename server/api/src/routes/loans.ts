import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createLoanSchema, createLoanEntrySchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";

export const loansRouter = Router();

// GET /api/loans — loan accounts (with entries) for the user's business
loansRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const loans = await prisma.loanAccount.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { entries: { orderBy: { date: "desc" } } },
  });
  res.json(loans);
});

// POST /api/loans — open a loan; principal seeds the outstanding balance
loansRouter.post("/", async (req, res) => {
  const parsed = createLoanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const loan = await prisma.loanAccount.create({
    data: { ...parsed.data, businessId, balance: parsed.data.principal },
  });
  res.status(201).json(loan);
});

// POST /api/loans/:id/entries — record an entry & adjust the balance atomically.
// disbursement/charge increase the outstanding; emi reduces it (clamped at 0).
loansRouter.post("/:id/entries", async (req, res) => {
  const parsed = createLoanEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const { amount, kind, date, note } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const loan = await tx.loanAccount.findFirst({
      where: { id: req.params.id, businessId, deletedAt: null },
    });
    if (!loan) return null;
    const delta = kind === "emi" ? -amount : amount;
    const balance = Math.max(0, loan.balance + delta);
    await tx.loanEntry.create({
      data: { loanId: loan.id, amount, kind, date: date ?? new Date(), note: note ?? null },
    });
    return tx.loanAccount.update({
      where: { id: loan.id },
      data: { balance },
      include: { entries: { orderBy: { date: "desc" } } },
    });
  });

  if (!result) return res.status(404).json({ error: "not_found" });
  res.status(201).json(result);
});

// DELETE /api/loans/:id — soft delete, scoped
loansRouter.delete("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.loanAccount.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});
