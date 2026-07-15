import { Router } from "express";
import { prisma } from "@invoixe/db";
import {
  updateBusinessSchema,
  settingsSchema,
  settingsPatchSchema,
  updateSeriesSchema,
  NUMBER_SERIES,
} from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";

export const businessRouter = Router();

/** True for a plain (non-array, non-null) object — the only thing we recurse into. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Recursively merge `patch` onto `base` (objects deep-merge; scalars/arrays replace). */
function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch as T) ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

// GET /api/business/current — the authenticated user's business
businessRouter.get("/current", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  res.json(await prisma.business.findUnique({ where: { id: businessId } }));
});

// PATCH /api/business/current — update firm settings (GSTIN, PAN, bank…)
businessRouter.patch("/current", async (req, res) => {
  const parsed = updateBusinessSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const updated = await prisma.business.update({ where: { id: businessId }, data });
  res.json(updated);
});

// GET /api/business/current/settings — normalized preferences (fills defaults).
businessRouter.get("/current/settings", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  // Parsing through the schema heals null/partial/legacy blobs to a full object.
  res.json(settingsSchema.parse(biz?.settings ?? {}));
});

// PATCH /api/business/current/settings — deep merge-patch, then re-normalize.
businessRouter.patch("/current/settings", async (req, res) => {
  const parsed = settingsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const base = settingsSchema.parse(biz?.settings ?? {});
  // Merge the subset onto the normalized base, then re-validate to guarantee the
  // stored blob is always a complete, well-typed settings object.
  const merged = settingsSchema.parse(deepMerge(base, parsed.data));
  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { settings: merged },
    select: { settings: true },
  });
  res.json(updated.settings);
});

// GET /api/business/current/series — editable document number prefixes.
businessRouter.get("/current/series", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const rows = await prisma.numberSeries.findMany({ where: { businessId } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  // Merge the canonical catalog with any saved rows so every series shows,
  // even before its first document reserves a number.
  res.json(
    NUMBER_SERIES.map((s) => {
      const row = byKey.get(s.key);
      return { key: s.key, label: s.label, prefix: row?.prefix ?? s.defaultPrefix, next: row?.next ?? 1 };
    })
  );
});

// PATCH /api/business/current/series — set one series' prefix (upsert).
businessRouter.patch("/current/series", async (req, res) => {
  const parsed = updateSeriesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_failed", details: parsed.error.flatten() });
  }
  const businessId = await getUserBusinessId(req.authUser!);
  const { key, prefix } = parsed.data;
  const row = await prisma.numberSeries.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, prefix, next: 1 },
    update: { prefix },
    select: { key: true, prefix: true, next: true },
  });
  res.json(row);
});
