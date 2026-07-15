import { Router } from "express";
import { prisma } from "@invoixe/db";
import { stockTransferSchema } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";

export const manufacturingRouter = Router();

// GET /api/bom/:itemId — BOM (raw materials) for a finished good
manufacturingRouter.get("/bom/:itemId", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const bom = await prisma.bom.findFirst({
    where: { businessId, itemId: req.params.itemId },
    include: { lines: true },
  });
  res.json(bom ?? { itemId: req.params.itemId, lines: [] });
});

// PUT /api/bom/:itemId — replace the BOM lines: [{ rawItemId, qty }]
manufacturingRouter.put("/bom/:itemId", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const lines: { rawItemId: string; qty: number }[] = Array.isArray(req.body?.lines) ? req.body.lines : [];
  const clean = lines.filter((l) => l.rawItemId && Number(l.qty) > 0);

  const bom = await prisma.bom.upsert({
    where: { businessId_itemId: { businessId, itemId: req.params.itemId } },
    create: { businessId, itemId: req.params.itemId },
    update: {},
  });
  await prisma.bomLine.deleteMany({ where: { bomId: bom.id } });
  if (clean.length) {
    await prisma.bomLine.createMany({ data: clean.map((l) => ({ bomId: bom.id, rawItemId: l.rawItemId, qty: Number(l.qty) })) });
  }
  const full = await prisma.bom.findUnique({ where: { id: bom.id }, include: { lines: true } });
  res.json(full);
});

// POST /api/production — build `qty` of a finished good, consuming raw materials
manufacturingRouter.post("/production", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const itemId = req.body?.itemId as string;
  const qty = Number(req.body?.qty);
  if (!itemId || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "invalid_input" });

  const bom = await prisma.bom.findFirst({ where: { businessId, itemId }, include: { lines: true } });
  if (!bom || bom.lines.length === 0) return res.status(400).json({ error: "no_bom" });

  const moves = [
    ...bom.lines.map((l) => ({ businessId, itemId: l.rawItemId, qty: -(l.qty * qty), reason: "production_consume" })),
    { businessId, itemId, qty, reason: "production_output" },
  ];
  await prisma.stockMovement.createMany({ data: moves });
  res.status(201).json({ ok: true, produced: qty, consumed: bom.lines.length });
});

// Godowns (warehouse master)
manufacturingRouter.get("/godowns", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  res.json(await prisma.godown.findMany({ where: { businessId, deletedAt: null }, orderBy: { createdAt: "asc" } }));
});

manufacturingRouter.post("/godowns", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  if (!req.body?.name?.trim()) return res.status(400).json({ error: "name_required" });
  res.status(201).json(await prisma.godown.create({ data: { businessId, name: String(req.body.name).trim() } }));
});

// GET /api/godowns/stock — per-godown, per-item balances (from transfer movements)
manufacturingRouter.get("/godowns/stock", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const rows = await prisma.stockMovement.groupBy({
    by: ["godownId", "itemId"],
    where: { businessId, godownId: { not: null } },
    _sum: { qty: true },
  });
  res.json(rows.map((r) => ({ godownId: r.godownId, itemId: r.itemId, qty: r._sum.qty ?? 0 })));
});

// GET /api/godowns/transfers — recent transfers
manufacturingRouter.get("/godowns/transfers", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  res.json(
    await prisma.stockTransfer.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 50 })
  );
});

// POST /api/godowns/transfer — move stock between two godowns (paired movements)
manufacturingRouter.post("/godowns/transfer", async (req, res) => {
  const parsed = stockTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const { itemId, fromGodownId, toGodownId, qty, note } = parsed.data;

  // Every referenced entity must belong to the caller's business (tenant guard).
  const [item, from, to] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, businessId, deletedAt: null } }),
    prisma.godown.findFirst({ where: { id: fromGodownId, businessId, deletedAt: null } }),
    prisma.godown.findFirst({ where: { id: toGodownId, businessId, deletedAt: null } }),
  ]);
  if (!item) return res.status(400).json({ error: "item_not_found" });
  if (!from || !to) return res.status(400).json({ error: "godown_not_found" });

  const transfer = await prisma.$transaction(async (tx) => {
    const t = await tx.stockTransfer.create({
      data: { businessId, itemId, fromGodownId, toGodownId, qty, note: note ?? null },
    });
    // Net-zero global stock: out of source, into destination.
    await tx.stockMovement.createMany({
      data: [
        { businessId, itemId, qty: -qty, reason: "transfer", godownId: fromGodownId, note: note ?? null },
        { businessId, itemId, qty: qty, reason: "transfer", godownId: toGodownId, note: note ?? null },
      ],
    });
    return t;
  });

  res.status(201).json(transfer);
});
