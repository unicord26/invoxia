import {
  BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Query,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createDocumentSchema, type DocumentType } from "@invoixe/types";
import { computeInvoice } from "@invoixe/core";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { recordStock } from "../lib/stock";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type DocumentBody = z.infer<typeof createDocumentSchema>;

// Per-type behaviour. purchaseSide docs flip the GST seller/buyer; stock is the
// direction goods move (credit note = sale return in; debit note = purchase return out).
const CONFIG: Record<DocumentType, { prefix: string; purchaseSide: boolean; stock: 0 | 1 | -1 }> = {
  estimate: { prefix: "EST", purchaseSide: false, stock: 0 },
  proforma: { prefix: "PRO", purchaseSide: false, stock: 0 },
  sale_order: { prefix: "SO", purchaseSide: false, stock: 0 },
  purchase_order: { prefix: "PO", purchaseSide: true, stock: 0 },
  delivery_challan: { prefix: "DC", purchaseSide: false, stock: 0 },
  credit_note: { prefix: "CN", purchaseSide: false, stock: 1 },
  debit_note: { prefix: "DN", purchaseSide: true, stock: -1 },
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(user: AuthUser, type?: DocumentType) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.transaction.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(type ? { type } : { type: { in: Object.keys(CONFIG) as DocumentType[] } }),
      },
      orderBy: { createdAt: "desc" },
      include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
    });
  }

  async create(user: AuthUser, data: DocumentBody) {
    const cfg = CONFIG[data.type];

    const businessId = await getUserBusinessId(user);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const party = data.partyId
      ? await this.prisma.party.findFirst({ where: { id: data.partyId, businessId, deletedAt: null } })
      : null;
    if (data.partyId && !party) throw new BadRequestException({ error: "party_not_found" });

    const our = business.stateCode ?? "27";
    const other = party?.stateCode ?? our;
    const sellerState = cfg.purchaseSide ? other : our;
    const buyerState = cfg.purchaseSide ? our : other;

    const computed = computeInvoice({
      sellerStateCode: sellerState,
      buyerStateCode: buyerState,
      lines: data.lines.map((l) => ({
        qty: l.qty, rate: l.rate, taxRate: l.taxRate, cessRate: l.cessRate,
        discountPercent: l.discountPercent, taxInclusive: l.taxInclusive, hsnSac: l.hsnSac ?? undefined,
      })),
    });

    const num = await nextNumber(businessId, data.type, cfg.prefix);
    const doc = await this.prisma.transaction.create({
      data: {
        businessId, type: data.type, status: "final",
        number: num.number, series: num.series, seq: num.seq,
        partyId: party?.id ?? null, partyName: party?.name ?? null, partyGstin: party?.gstin ?? null,
        placeOfSupply: other, interState: computed.interState,
        referenceNo: data.referenceNo ?? null, date: data.date ?? new Date(), notes: data.notes ?? null,
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

    if (cfg.stock !== 0) await recordStock(businessId, doc.id, data.lines, cfg.stock, data.type);
    return doc;
  }

  /** Turn an estimate/order into a sale invoice. */
  async convert(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const src = await this.prisma.transaction.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
    if (!src) throw new NotFoundException({ error: "not_found" });
    if (src.convertedToId) {
      throw new BadRequestException({ error: "already_converted", invoiceId: src.convertedToId });
    }

    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const party = src.partyId ? await this.prisma.party.findUnique({ where: { id: src.partyId } }) : null;
    const our = business.stateCode ?? "27";
    const buyerState = party?.stateCode ?? our;

    const inputLines = src.lines.map((l) => ({
      qty: l.qty, rate: l.rate, taxRate: l.taxRate, cessRate: l.cessRate,
      discountPercent: l.discountPercent, taxInclusive: l.taxInclusive, hsnSac: l.hsnSac ?? undefined,
    }));
    const computed = computeInvoice({ sellerStateCode: our, buyerStateCode: buyerState, lines: inputLines });
    const num = await nextNumber(businessId, "sale", "INV");

    const invoice = await this.prisma.transaction.create({
      data: {
        businessId, type: "sale", status: "final",
        number: num.number, series: num.series, seq: num.seq,
        partyId: src.partyId, partyName: src.partyName, partyGstin: src.partyGstin,
        placeOfSupply: buyerState, interState: computed.interState, date: new Date(),
        notes: `Converted from ${src.number}`,
        subTotal: computed.totals.subTotal, totalDiscount: computed.totals.totalDiscount,
        cgst: computed.totals.cgst, sgst: computed.totals.sgst, igst: computed.totals.igst,
        cess: computed.totals.cess, totalTax: computed.totals.totalTax,
        roundOff: computed.totals.roundOff, grandTotal: computed.totals.grandTotal,
        lines: {
          create: src.lines.map((l, i) => {
            const c = computed.lines[i]!;
            return {
              lineNo: i + 1, itemId: l.itemId, description: l.description, hsnSac: l.hsnSac,
              qty: l.qty, unit: l.unit, rate: l.rate, discountPercent: l.discountPercent,
              taxRate: l.taxRate, cessRate: l.cessRate, taxInclusive: l.taxInclusive,
              taxable: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, cess: c.cess, lineTotal: c.lineTotal,
            };
          }),
        },
      },
    });

    await recordStock(businessId, invoice.id, src.lines, -1, "sale");
    await this.prisma.transaction.update({ where: { id: src.id }, data: { convertedToId: invoice.id } });
    return invoice;
  }
}

@Controller("documents")
@UseGuards(SupabaseAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("type") type?: DocumentType) {
    return this.documents.list(user, type);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createDocumentSchema)) body: DocumentBody) {
    return this.documents.create(user, body);
  }

  @Post(":id/convert")
  @HttpCode(201)
  convert(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.documents.convert(user, id);
  }
}

@Module({ controllers: [DocumentsController], providers: [DocumentsService] })
export class DocumentsModule {}
