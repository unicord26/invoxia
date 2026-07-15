import { Body, Controller, Get, Injectable, Module, Patch, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import {
  updateBusinessSchema,
  settingsSchema,
  settingsPatchSchema,
  updateSeriesSchema,
  NUMBER_SERIES,
} from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const updateBusinessPatchSchema = updateBusinessSchema.partial();

type BusinessPatch = z.infer<typeof updateBusinessPatchSchema>;
type SettingsPatch = z.infer<typeof settingsPatchSchema>;
type SeriesPatch = z.infer<typeof updateSeriesSchema>;

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

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaClient) {}

  async current(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.business.findUnique({ where: { id: businessId } });
  }

  /** Update firm settings (GSTIN, PAN, bank…). */
  async update(user: AuthUser, patch: BusinessPatch) {
    const businessId = await getUserBusinessId(user);
    const data = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === "" ? null : v]));
    return this.prisma.business.update({ where: { id: businessId }, data });
  }

  /** Normalized preferences (fills defaults). */
  async settings(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });
    // Parsing through the schema heals null/partial/legacy blobs to a full object.
    return settingsSchema.parse(biz?.settings ?? {});
  }

  /** Deep merge-patch, then re-normalize. */
  async patchSettings(user: AuthUser, patch: SettingsPatch) {
    const businessId = await getUserBusinessId(user);
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    });
    const base = settingsSchema.parse(biz?.settings ?? {});
    // Merge the subset onto the normalized base, then re-validate to guarantee the
    // stored blob is always a complete, well-typed settings object.
    const merged = settingsSchema.parse(deepMerge(base, patch));
    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { settings: merged },
      select: { settings: true },
    });
    return updated.settings;
  }

  /** Editable document number prefixes. */
  async series(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const rows = await this.prisma.numberSeries.findMany({ where: { businessId } });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    // Merge the canonical catalog with any saved rows so every series shows,
    // even before its first document reserves a number.
    return NUMBER_SERIES.map((s) => {
      const row = byKey.get(s.key);
      return { key: s.key, label: s.label, prefix: row?.prefix ?? s.defaultPrefix, next: row?.next ?? 1 };
    });
  }

  /** Set one series' prefix (upsert). */
  async patchSeries(user: AuthUser, { key, prefix }: SeriesPatch) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.numberSeries.upsert({
      where: { businessId_key: { businessId, key } },
      create: { businessId, key, prefix, next: 1 },
      update: { prefix },
      select: { key: true, prefix: true, next: true },
    });
  }
}

@Controller("business")
@UseGuards(SupabaseAuthGuard)
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get("current")
  current(@CurrentUser() user: AuthUser) {
    return this.business.current(user);
  }

  @Patch("current")
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateBusinessPatchSchema)) body: BusinessPatch
  ) {
    return this.business.update(user, body);
  }

  @Get("current/settings")
  settings(@CurrentUser() user: AuthUser) {
    return this.business.settings(user);
  }

  @Patch("current/settings")
  patchSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(settingsPatchSchema)) body: SettingsPatch
  ) {
    return this.business.patchSettings(user, body);
  }

  @Get("current/series")
  series(@CurrentUser() user: AuthUser) {
    return this.business.series(user);
  }

  @Patch("current/series")
  patchSeries(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(updateSeriesSchema)) body: SeriesPatch) {
    return this.business.patchSeries(user, body);
  }
}

@Module({ controllers: [BusinessController], providers: [BusinessService] })
export class BusinessModule {}
