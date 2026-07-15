import { Router } from "express";
import { prisma } from "@invoixe/db";
import { getUserBusinessId } from "../lib/business";

export const businessesRouter = Router();

// GET /api/businesses — all firms the user belongs to, with their role
businessesRouter.get("/", async (req, res) => {
  const userId = req.authUser!.id;
  // Ensure the user has at least one firm (provisions on first login).
  await getUserBusinessId(req.authUser!);
  const memberships = await prisma.membership.findMany({
    where: { userId, deletedAt: null },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    memberships
      .filter((m) => m.business && !m.business.deletedAt)
      .map((m) => ({ id: m.business.id, name: m.business.name, gstin: m.business.gstin, role: m.role }))
  );
});

// POST /api/businesses — create a new firm (caller becomes owner)
businessesRouter.post("/", async (req, res) => {
  const userId = req.authUser!.id;
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email: req.authUser!.email }, update: {} });
  const business = await prisma.business.create({
    data: { name, stateCode: req.body?.stateCode || "27" },
  });
  await prisma.membership.create({ data: { userId, businessId: business.id, role: "owner" } });
  res.status(201).json({ id: business.id, name: business.name, role: "owner" });
});
