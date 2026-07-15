import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createPartySchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";
import { signedBalanceDelta } from "../lib/ledger";

export const partiesRouter = Router();

// businessId is derived from the authenticated user, never trusted from the client.
const partyBodySchema = createPartySchema.omit({ businessId: true });

// GET /api/parties
partiesRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const parties = await prisma.party.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { name: "asc" },
  });
  res.json(parties);
});

// GET /api/parties/:id/ledger — running balance + outstanding for one party
partiesRouter.get("/:id/ledger", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const party = await prisma.party.findFirst({
    where: { id: req.params.id, businessId, deletedAt: null },
  });
  if (!party) return res.status(404).json({ error: "not_found" });

  const txns = await prisma.transaction.findMany({
    where: { businessId, partyId: party.id, deletedAt: null },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, type: true, number: true, date: true,
      grandTotal: true, paymentMode: true, referenceNo: true,
    },
  });

  let balance = party.openingBalance;
  const entries = txns.map((t) => {
    const delta = signedBalanceDelta(t.type, t.grandTotal);
    balance += delta;
    return { ...t, debit: delta > 0 ? delta : 0, credit: delta < 0 ? -delta : 0, balance };
  });

  res.json({
    party: { id: party.id, name: party.name, type: party.type, gstin: party.gstin, phone: party.phone },
    openingBalance: party.openingBalance,
    entries,
    outstanding: balance,
  });
});

// POST /api/parties
partiesRouter.post("/", async (req, res) => {
  const parsed = partyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const party = await prisma.party.create({ data: { ...parsed.data, businessId } });
  res.status(201).json(party);
});

// PATCH /api/parties/:id — scoped to the user's business
partiesRouter.patch("/:id", async (req, res) => {
  const parsed = partyBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.party.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: parsed.data,
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.json(await prisma.party.findUnique({ where: { id: req.params.id } }));
});

// DELETE /api/parties/:id — soft delete, scoped
partiesRouter.delete("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.party.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});
