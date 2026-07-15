import {
  BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, Param, Post, Put, UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { stockTransferSchema } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type TransferBody = z.infer<typeof stockTransferSchema>;

interface BomBody {
  lines?: unknown;
}
interface ProductionBody {
  itemId?: string;
  qty?: unknown;
}
interface GodownBody {
  name?: string;
}

@Injectable()
export class ManufacturingService {
  constructor(private readonly prisma: PrismaClient) {}

  /** BOM (raw materials) for a finished good. */
  async bom(user: AuthUser, itemId: string) {
    const businessId = await getUserBusinessId(user);
    const bom = await this.prisma.bom.findFirst({ where: { businessId, itemId }, include: { lines: true } });
    return bom ?? { itemId, lines: [] };
  }

  /** Replace the BOM lines: [{ rawItemId, qty }]. */
  async setBom(user: AuthUser, itemId: string, body: BomBody) {
    const businessId = await getUserBusinessId(user);
    const lines: { rawItemId: string; qty: number }[] = Array.isArray(body?.lines) ? body.lines : [];
    const clean = lines.filter((l) => l.rawItemId && Number(l.qty) > 0);

    const bom = await this.prisma.bom.upsert({
      where: { businessId_itemId: { businessId, itemId } },
      create: { businessId, itemId },
      update: {},
    });
    await this.prisma.bomLine.deleteMany({ where: { bomId: bom.id } });
    if (clean.length) {
      await this.prisma.bomLine.createMany({
        data: clean.map((l) => ({ bomId: bom.id, rawItemId: l.rawItemId, qty: Number(l.qty) })),
      });
    }
    return this.prisma.bom.findUnique({ where: { id: bom.id }, include: { lines: true } });
  }

  /** Build `qty` of a finished good, consuming raw materials. */
  async produce(user: AuthUser, body: ProductionBody) {
    const businessId = await getUserBusinessId(user);
    const itemId = body?.itemId;
    const qty = Number(body?.qty);
    if (!itemId || !Number.isFinite(qty) || qty <= 0) throw new BadRequestException({ error: "invalid_input" });

    const bom = await this.prisma.bom.findFirst({ where: { businessId, itemId }, include: { lines: true } });
    if (!bom || bom.lines.length === 0) throw new BadRequestException({ error: "no_bom" });

    const moves = [
      ...bom.lines.map((l) => ({
        businessId, itemId: l.rawItemId, qty: -(l.qty * qty), reason: "production_consume",
      })),
      { businessId, itemId, qty, reason: "production_output" },
    ];
    await this.prisma.stockMovement.createMany({ data: moves });
    return { ok: true, produced: qty, consumed: bom.lines.length };
  }

  // ---- Godowns (warehouse master) ----

  async godowns(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.godown.findMany({ where: { businessId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  }

  async createGodown(user: AuthUser, body: GodownBody) {
    const businessId = await getUserBusinessId(user);
    if (!body?.name?.trim()) throw new BadRequestException({ error: "name_required" });
    return this.prisma.godown.create({ data: { businessId, name: String(body.name).trim() } });
  }

  /** Per-godown, per-item balances (from transfer movements). */
  async godownStock(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const rows = await this.prisma.stockMovement.groupBy({
      by: ["godownId", "itemId"],
      where: { businessId, godownId: { not: null } },
      _sum: { qty: true },
    });
    return rows.map((r) => ({ godownId: r.godownId, itemId: r.itemId, qty: r._sum.qty ?? 0 }));
  }

  async transfers(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.stockTransfer.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  /** Move stock between two godowns (paired movements). */
  async transfer(user: AuthUser, data: TransferBody) {
    const businessId = await getUserBusinessId(user);
    const { itemId, fromGodownId, toGodownId, qty, note } = data;

    // Every referenced entity must belong to the caller's business (tenant guard).
    const [item, from, to] = await Promise.all([
      this.prisma.item.findFirst({ where: { id: itemId, businessId, deletedAt: null } }),
      this.prisma.godown.findFirst({ where: { id: fromGodownId, businessId, deletedAt: null } }),
      this.prisma.godown.findFirst({ where: { id: toGodownId, businessId, deletedAt: null } }),
    ]);
    if (!item) throw new BadRequestException({ error: "item_not_found" });
    if (!from || !to) throw new BadRequestException({ error: "godown_not_found" });

    return this.prisma.$transaction(async (tx) => {
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
  }
}

// These three controllers were one Express router mounted at /api, so their paths
// are /api/bom, /api/production and /api/godowns — not /api/manufacturing/*.

@Controller("bom")
@UseGuards(SupabaseAuthGuard)
export class BomController {
  constructor(private readonly mfg: ManufacturingService) {}

  @Get(":itemId")
  bom(@CurrentUser() user: AuthUser, @Param("itemId") itemId: string) {
    return this.mfg.bom(user, itemId);
  }

  @Put(":itemId")
  setBom(@CurrentUser() user: AuthUser, @Param("itemId") itemId: string, @Body() body: BomBody) {
    return this.mfg.setBom(user, itemId, body);
  }
}

@Controller("production")
@UseGuards(SupabaseAuthGuard)
export class ProductionController {
  constructor(private readonly mfg: ManufacturingService) {}

  @Post()
  @HttpCode(201)
  produce(@CurrentUser() user: AuthUser, @Body() body: ProductionBody) {
    return this.mfg.produce(user, body);
  }
}

@Controller("godowns")
@UseGuards(SupabaseAuthGuard)
export class GodownsController {
  constructor(private readonly mfg: ManufacturingService) {}

  @Get()
  godowns(@CurrentUser() user: AuthUser) {
    return this.mfg.godowns(user);
  }

  @Post()
  @HttpCode(201)
  createGodown(@CurrentUser() user: AuthUser, @Body() body: GodownBody) {
    return this.mfg.createGodown(user, body);
  }

  @Get("stock")
  godownStock(@CurrentUser() user: AuthUser) {
    return this.mfg.godownStock(user);
  }

  @Get("transfers")
  transfers(@CurrentUser() user: AuthUser) {
    return this.mfg.transfers(user);
  }

  @Post("transfer")
  @HttpCode(201)
  transfer(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(stockTransferSchema)) body: TransferBody) {
    return this.mfg.transfer(user, body);
  }
}

@Module({
  controllers: [BomController, ProductionController, GodownsController],
  providers: [ManufacturingService],
})
export class ManufacturingModule {}
