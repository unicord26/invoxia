import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createPartySchema, createItemSchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";

export const backupRouter = Router();

// GET /api/backup — full JSON snapshot of the current business
backupRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const [business, parties, items, categories, transactions, movements, bankAccounts, bankEntries] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.party.findMany({ where: { businessId, deletedAt: null } }),
    prisma.item.findMany({ where: { businessId, deletedAt: null } }),
    prisma.itemCategory.findMany({ where: { businessId, deletedAt: null } }),
    prisma.transaction.findMany({ where: { businessId, deletedAt: null }, include: { lines: true } }),
    prisma.stockMovement.findMany({ where: { businessId } }),
    prisma.bankAccount.findMany({ where: { businessId, deletedAt: null } }),
    prisma.bankEntry.findMany({ where: { businessId } }),
  ]);
  res.json({
    _leafxBackup: 1,
    exportedAt: new Date().toISOString(),
    business,
    parties, items, categories, transactions, movements, bankAccounts, bankEntries,
  });
});

// POST /api/import — bulk-create parties and/or items from arrays (CSV/JSON upload)
backupRouter.post("/import", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const partyBody = createPartySchema.omit({ businessId: true });
  const itemBody = createItemSchema.omit({ businessId: true });

  const inParties: unknown[] = Array.isArray(req.body?.parties) ? req.body.parties : [];
  const inItems: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];

  const goodParties = inParties.map((p) => partyBody.safeParse(p)).filter((r) => r.success).map((r) => ({ ...(r as any).data, businessId }));
  const goodItems = inItems.map((i) => itemBody.safeParse(i)).filter((r) => r.success).map((r) => ({ ...(r as any).data, businessId }));

  if (goodParties.length) await prisma.party.createMany({ data: goodParties });
  if (goodItems.length) await prisma.item.createMany({ data: goodItems });

  res.status(201).json({
    partiesImported: goodParties.length,
    partiesSkipped: inParties.length - goodParties.length,
    itemsImported: goodItems.length,
    itemsSkipped: inItems.length - goodItems.length,
  });
});
