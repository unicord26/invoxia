import { Router } from "express";
import { prisma } from "@invoixe/db";
import { createItemSchema, createBatchSchema, createSerialSchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";
import { getStockMap } from "../lib/stock";

export const itemsRouter = Router();

const itemBodySchema = createItemSchema.omit({ businessId: true });

/** Verify an item belongs to the caller's business; returns it or null. */
async function ownedItem(businessId: string, itemId: string) {
  return prisma.item.findFirst({ where: { id: itemId, businessId, deletedAt: null } });
}

// GET /api/items — includes live currentStock (openingStock + movements)
itemsRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const [items, stock] = await Promise.all([
    prisma.item.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: "asc" } }),
    getStockMap(businessId),
  ]);
  res.json(items.map((it) => ({ ...it, currentStock: stock[it.id] ?? it.openingStock })));
});

// POST /api/items/:id/adjust — record a signed stock adjustment
itemsRouter.post("/:id/adjust", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const qty = Number(req.body?.qty);
  if (!Number.isFinite(qty) || qty === 0) return res.status(400).json({ error: "invalid_qty" });
  const item = await prisma.item.findFirst({ where: { id: req.params.id, businessId, deletedAt: null } });
  if (!item) return res.status(404).json({ error: "not_found" });
  await prisma.stockMovement.create({
    data: { businessId, itemId: item.id, qty, reason: "adjustment", note: req.body?.note ?? null },
  });
  res.status(201).json({ ok: true });
});

// POST /api/items
itemsRouter.post("/", async (req, res) => {
  const parsed = itemBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const item = await prisma.item.create({ data: { ...parsed.data, businessId } });
  res.status(201).json(item);
});

// PATCH /api/items/:id — scoped
itemsRouter.patch("/:id", async (req, res) => {
  const parsed = itemBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.item.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: parsed.data,
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.json(await prisma.item.findUnique({ where: { id: req.params.id } }));
});

// ---- Batches (item-scoped, tenant-guarded) ----
itemsRouter.get("/:id/batches", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  if (!(await ownedItem(businessId, req.params.id))) return res.status(404).json({ error: "not_found" });
  res.json(await prisma.itemBatch.findMany({ where: { itemId: req.params.id }, orderBy: { createdAt: "desc" } }));
});

itemsRouter.post("/:id/batches", async (req, res) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  const businessId = await getUserBusinessId(req.authUser!);
  if (!(await ownedItem(businessId, req.params.id))) return res.status(404).json({ error: "not_found" });
  const batch = await prisma.itemBatch.create({
    data: { businessId, itemId: req.params.id, ...parsed.data },
  });
  res.status(201).json(batch);
});

itemsRouter.delete("/:id/batches/:batchId", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.itemBatch.deleteMany({
    where: { id: req.params.batchId, itemId: req.params.id, businessId },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});

// ---- Serial numbers (item-scoped, tenant-guarded) ----
itemsRouter.get("/:id/serials", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  if (!(await ownedItem(businessId, req.params.id))) return res.status(404).json({ error: "not_found" });
  res.json(await prisma.serialNumber.findMany({ where: { itemId: req.params.id }, orderBy: { createdAt: "desc" } }));
});

itemsRouter.post("/:id/serials", async (req, res) => {
  const parsed = createSerialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  const businessId = await getUserBusinessId(req.authUser!);
  if (!(await ownedItem(businessId, req.params.id))) return res.status(404).json({ error: "not_found" });
  // Pre-check keeps the common duplicate case off the error log; the
  // @@unique([itemId, serial]) constraint is still the race-safe backstop.
  const existing = await prisma.serialNumber.findFirst({
    where: { itemId: req.params.id, serial: parsed.data.serial },
    select: { id: true },
  });
  if (existing) return res.status(409).json({ error: "duplicate_serial" });
  try {
    const serial = await prisma.serialNumber.create({
      data: { businessId, itemId: req.params.id, serial: parsed.data.serial },
    });
    res.status(201).json(serial);
  } catch {
    res.status(409).json({ error: "duplicate_serial" });
  }
});

itemsRouter.delete("/:id/serials/:serialId", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.serialNumber.deleteMany({
    where: { id: req.params.serialId, itemId: req.params.id, businessId },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});

// DELETE /api/items/:id — soft delete, scoped
itemsRouter.delete("/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { count } = await prisma.item.updateMany({
    where: { id: req.params.id, businessId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});
