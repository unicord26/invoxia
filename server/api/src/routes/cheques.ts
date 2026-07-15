import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createChequeSchema, chequeStatusUpdateSchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";

export const chequesRouter = Router();

// GET /api/cheques — all cheques for the user's business
chequesRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const cheques = await prisma.cheque.findMany({
    where: { businessId, deletedAt: null },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  res.json(cheques);
});

// POST /api/cheques
chequesRouter.post("/", async (req, res) => {
  const parsed = createChequeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const cheque = await prisma.cheque.create({ data: { ...parsed.data, businessId } });
  res.status(201).json(cheque);
});

// PATCH /api/cheques/:id/status — advance the cheque lifecycle, scoped
chequesRouter.patch("/:id/status", async (req, res) => {
  const parsed = chequeStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.cheque.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: { status: parsed.data.status },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.json(await prisma.cheque.findUnique({ where: { id: req.params.id } }));
});

// DELETE /api/cheques/:id — soft delete, scoped
chequesRouter.delete("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.cheque.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});
