import { Router } from "express";
import { prisma } from "@invoixe/db";
import { getUserBusinessId } from "../lib/business";

export const cardsRouter = Router();

const NETWORKS = ["visa", "mastercard", "rupay", "amex", "other"];
const KINDS = ["debit", "credit"];

// GET /api/cards — saved payment cards (PCI-safe reference data only)
cardsRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const cards = await prisma.paymentCard.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json(cards);
});

// POST /api/cards — save a card. We deliberately accept ONLY non-sensitive
// reference fields. Any full card number or CVV in the body is ignored: storing
// them is prohibited by PCI-DSS.
cardsRouter.post("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { label, network, kind, last4, expiryLabel, holderName } = req.body ?? {};
  if (!label?.trim()) return res.status(400).json({ error: "label_required" });
  // Keep digits only, then take the last 4 — so even if a full PAN is pasted we
  // never persist more than the last four.
  const digits = String(last4 ?? "").replace(/\D/g, "");
  if (digits.length < 4) return res.status(400).json({ error: "last4_required" });
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const card = await prisma.paymentCard.create({
    data: {
      businessId,
      label: String(label).trim(),
      network: NETWORKS.includes(network) ? network : "other",
      kind: KINDS.includes(kind) ? kind : "debit",
      last4: digits.slice(-4),
      expiryLabel: clean(expiryLabel),
      holderName: clean(holderName),
    },
  });
  res.status(201).json(card);
});

// DELETE /api/cards/:id — soft-delete a saved card
cardsRouter.delete("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const card = await prisma.paymentCard.findFirst({
    where: { id: req.params.id, businessId, deletedAt: null },
  });
  if (!card) return res.status(404).json({ error: "not_found" });
  await prisma.paymentCard.update({ where: { id: card.id }, data: { deletedAt: new Date() } });
  res.json({ ok: true });
});
