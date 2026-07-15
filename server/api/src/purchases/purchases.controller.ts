import {
  BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createPurchaseSchema } from "@invoixe/types";
import { computeInvoice } from "@invoixe/core";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { recordStock } from "../lib/stock";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type PurchaseBody = z.infer<typeof createPurchaseSchema>;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.transaction.findMany({
      where: { businessId, type: "purchase", deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const purchase = await this.prisma.transaction.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { party: true, business: true, lines: { orderBy: { lineNo: "asc" } } },
    });
    if (!purchase) throw new NotFoundException({ error: "not_found" });
    return purchase;
  }

  /** Supplier bill (input GST). The supplier is the "seller". */
  async create(user: AuthUser, data: PurchaseBody) {
    const businessId = await getUserBusinessId(user);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const party = data.partyId
      ? await this.prisma.party.findFirst({ where: { id: data.partyId, businessId, deletedAt: null } })
      : null;
    if (data.partyId && !party) throw new BadRequestException({ error: "party_not_found" });

    const buyerState = business.stateCode ?? "27";
    const sellerState = party?.stateCode ?? buyerState;

    const computed = computeInvoice({
      sellerStateCode: sellerState,
      buyerStateCode: buyerState,
      lines: data.lines.map((l) => ({
        qty: l.qty, rate: l.rate, taxRate: l.taxRate, cessRate: l.cessRate,
        discountPercent: l.discountPercent, taxInclusive: l.taxInclusive, hsnSac: l.hsnSac ?? undefined,
      })),
    });

    const num = await nextNumber(businessId, "purchase", "PUR");

    const purchase = await this.prisma.transaction.create({
      data: {
        businessId, type: "purchase", status: "final",
        number: num.number, series: num.series, seq: num.seq,
        partyId: party?.id ?? null, partyName: party?.name ?? null, partyGstin: party?.gstin ?? null,
        placeOfSupply: sellerState, interState: computed.interState,
        referenceNo: data.referenceNo ?? null,
        date: data.date ?? new Date(), dueDate: data.dueDate ?? null, notes: data.notes ?? null,
        subTotal: computed.totals.subTotal, totalDiscount: computed.totals.totalDiscount,
        cgst: computed.totals.cgst, sgst: computed.totals.sgst, igst: computed.totals.igst,
        cess: computed.totals.cess, totalTax: computed.totals.totalTax,
        roundOff: computed.totals.roundOff, grandTotal: computed.totals.grandTotal,
        lines: {
          create: data.lines.map((l, i) => {
            const c = computed.lines[i]!;
            return {
              lineNo: i + 1, itemId: l.itemId ?? null, description: l.description, hsnSac: l.hsnSac ?? null,
              qty: l.qty, unit: l.unit, rate: l.rate, discountPercent: l.discountPercent,
              taxRate: l.taxRate, cessRate: l.cessRate, taxInclusive: l.taxInclusive,
              taxable: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, cess: c.cess, lineTotal: c.lineTotal,
            };
          }),
        },
      },
      include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
    });

    // Purchase increases stock for product lines.
    await recordStock(businessId, purchase.id, data.lines, 1, "purchase");

    return purchase;
  }
}

@Controller("purchases")
@UseGuards(SupabaseAuthGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.purchases.list(user);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.purchases.findOne(user, id);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createPurchaseSchema)) body: PurchaseBody) {
    return this.purchases.create(user, body);
  }
}

@Module({ controllers: [PurchasesController], providers: [PurchasesService] })
export class PurchasesModule {}
