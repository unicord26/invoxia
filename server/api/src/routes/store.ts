import { Router } from "express";
import { prisma } from "@invoixe/db";

// PUBLIC router (no auth) — a shareable online catalog for a business.
export const storeRouter = Router();

// GET /api/store/:businessId/catalog
storeRouter.get("/:businessId/catalog", async (req, res) => {
  const business = await prisma.business.findFirst({
    where: { id: req.params.businessId, deletedAt: null },
    select: { id: true, name: true, phone: true, address: true },
  });
  if (!business) return res.status(404).json({ error: "not_found" });

  const items = await prisma.item.findMany({
    where: { businessId: business.id, deletedAt: null, type: "product" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, salePrice: true, unit: true, taxRate: true },
  });

  res.json({ business, items });
});
