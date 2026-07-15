import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module,
  NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createItemSchema, createBatchSchema, createSerialSchema } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { getStockMap } from "../lib/stock";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

// businessId is derived from the authenticated user, never trusted from the client.
export const itemBodySchema = createItemSchema.omit({ businessId: true });
export const itemPatchSchema = itemBodySchema.partial();

type ItemBody = z.infer<typeof itemBodySchema>;
type ItemPatch = z.infer<typeof itemPatchSchema>;
type BatchBody = z.infer<typeof createBatchSchema>;
type SerialBody = z.infer<typeof createSerialSchema>;

interface AdjustBody {
  qty?: unknown;
  note?: string | null;
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Verify an item belongs to the caller's business; returns it or null. */
  private ownedItem(businessId: string, itemId: string) {
    return this.prisma.item.findFirst({ where: { id: itemId, businessId, deletedAt: null } });
  }

  /** Includes live currentStock (openingStock + movements). */
  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const [items, stock] = await Promise.all([
      this.prisma.item.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: "asc" } }),
      getStockMap(businessId),
    ]);
    return items.map((it) => ({ ...it, currentStock: stock[it.id] ?? it.openingStock }));
  }

  async create(user: AuthUser, data: ItemBody) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.item.create({ data: { ...data, businessId } });
  }

  async update(user: AuthUser, id: string, data: ItemPatch) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.item.updateMany({
      where: { id, businessId, deletedAt: null },
      data,
    });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
    return this.prisma.item.findUnique({ where: { id } });
  }

  async remove(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.item.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
  }

  /** Record a signed stock adjustment. */
  async adjust(user: AuthUser, id: string, body: AdjustBody) {
    const businessId = await getUserBusinessId(user);
    const qty = Number(body?.qty);
    if (!Number.isFinite(qty) || qty === 0) throw new BadRequestException({ error: "invalid_qty" });

    const item = await this.ownedItem(businessId, id);
    if (!item) throw new NotFoundException({ error: "not_found" });

    await this.prisma.stockMovement.create({
      data: { businessId, itemId: item.id, qty, reason: "adjustment", note: body?.note ?? null },
    });
    return { ok: true };
  }

  // ---- Batches (item-scoped, tenant-guarded) ----

  async batches(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    if (!(await this.ownedItem(businessId, id))) throw new NotFoundException({ error: "not_found" });
    return this.prisma.itemBatch.findMany({ where: { itemId: id }, orderBy: { createdAt: "desc" } });
  }

  async createBatch(user: AuthUser, id: string, data: BatchBody) {
    const businessId = await getUserBusinessId(user);
    if (!(await this.ownedItem(businessId, id))) throw new NotFoundException({ error: "not_found" });
    return this.prisma.itemBatch.create({ data: { businessId, itemId: id, ...data } });
  }

  async removeBatch(user: AuthUser, id: string, batchId: string) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.itemBatch.deleteMany({ where: { id: batchId, itemId: id, businessId } });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
  }

  // ---- Serial numbers (item-scoped, tenant-guarded) ----

  async serials(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    if (!(await this.ownedItem(businessId, id))) throw new NotFoundException({ error: "not_found" });
    return this.prisma.serialNumber.findMany({ where: { itemId: id }, orderBy: { createdAt: "desc" } });
  }

  async createSerial(user: AuthUser, id: string, data: SerialBody) {
    const businessId = await getUserBusinessId(user);
    if (!(await this.ownedItem(businessId, id))) throw new NotFoundException({ error: "not_found" });

    // Pre-check keeps the common duplicate case off the error log; the
    // @@unique([itemId, serial]) constraint is still the race-safe backstop.
    const existing = await this.prisma.serialNumber.findFirst({
      where: { itemId: id, serial: data.serial },
      select: { id: true },
    });
    if (existing) throw new ConflictException({ error: "duplicate_serial" });

    try {
      return await this.prisma.serialNumber.create({ data: { businessId, itemId: id, serial: data.serial } });
    } catch {
      throw new ConflictException({ error: "duplicate_serial" });
    }
  }

  async removeSerial(user: AuthUser, id: string, serialId: string) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.serialNumber.deleteMany({ where: { id: serialId, itemId: id, businessId } });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
  }
}

@Controller("items")
@UseGuards(SupabaseAuthGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.items.list(user);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(itemBodySchema)) body: ItemBody) {
    return this.items.create(user, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(itemPatchSchema)) body: ItemPatch
  ) {
    return this.items.update(user, id, body);
  }

  @Post(":id/adjust")
  @HttpCode(201)
  adjust(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: AdjustBody) {
    return this.items.adjust(user, id, body);
  }

  @Get(":id/batches")
  batches(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.items.batches(user, id);
  }

  @Post(":id/batches")
  @HttpCode(201)
  createBatch(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createBatchSchema)) body: BatchBody
  ) {
    return this.items.createBatch(user, id, body);
  }

  @Delete(":id/batches/:batchId")
  @HttpCode(204)
  removeBatch(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("batchId") batchId: string) {
    return this.items.removeBatch(user, id, batchId);
  }

  @Get(":id/serials")
  serials(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.items.serials(user, id);
  }

  @Post(":id/serials")
  @HttpCode(201)
  createSerial(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createSerialSchema)) body: SerialBody
  ) {
    return this.items.createSerial(user, id, body);
  }

  @Delete(":id/serials/:serialId")
  @HttpCode(204)
  removeSerial(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("serialId") serialId: string) {
    return this.items.removeSerial(user, id, serialId);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.items.remove(user, id);
  }
}

@Module({ controllers: [ItemsController], providers: [ItemsService] })
export class ItemsModule {}
