import {
  BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createInvoiceSchema } from "@invoixe/types";
import { computeInvoice } from "@invoixe/core";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { recordStock } from "../lib/stock";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type InvoiceBody = z.infer<typeof createInvoiceSchema>;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Sale invoices for the user's business. */
  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.transaction.findMany({
      where: { businessId, type: "sale", deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const invoice = await this.prisma.transaction.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { party: true, business: true, lines: { orderBy: { lineNo: "asc" } } },
    });
    if (!invoice) throw new NotFoundException({ error: "not_found" });
    return invoice;
  }

  /** Create a sale invoice (totals computed by the tax engine). */
  async create(user: AuthUser, data: InvoiceBody) {
    const businessId = await getUserBusinessId(user);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const party = data.partyId
      ? await this.prisma.party.findFirst({ where: { id: data.partyId, businessId, deletedAt: null } })
      : null;
    if (data.partyId && !party) throw new BadRequestException({ error: "party_not_found" });

    const sellerState = business.stateCode ?? "27";
    const buyerState = party?.stateCode ?? sellerState;

    const computed = computeInvoice({
      sellerStateCode: sellerState,
      buyerStateCode: buyerState,
      lines: data.lines.map((l) => ({
        qty: l.qty,
        rate: l.rate,
        taxRate: l.taxRate,
        cessRate: l.cessRate,
        discountPercent: l.discountPercent,
        taxInclusive: l.taxInclusive,
        hsnSac: l.hsnSac ?? undefined,
      })),
      adjustments: {
        discountFlat: data.discountFlat,
        additionalCharges: data.additionalCharges,
        tcsRate: data.tcsRate,
        tdsRate: data.tdsRate,
      },
    });

    const num = await nextNumber(businessId, "sale", "INV");

    const invoice = await this.prisma.transaction.create({
      data: {
        businessId,
        type: "sale",
        status: "final",
        number: num.number,
        series: num.series,
        seq: num.seq,
        partyId: party?.id ?? null,
        partyName: party?.name ?? null,
        partyGstin: party?.gstin ?? null,
        placeOfSupply: buyerState,
        interState: computed.interState,
        date: data.date ?? new Date(),
        dueDate: data.dueDate ?? null,
        notes: data.notes ?? null,
        subTotal: computed.totals.subTotal,
        totalDiscount: computed.totals.totalDiscount,
        cgst: computed.totals.cgst,
        sgst: computed.totals.sgst,
        igst: computed.totals.igst,
        cess: computed.totals.cess,
        totalTax: computed.totals.totalTax,
        discountFlat: computed.totals.discountFlat,
        additionalCharges: data.additionalCharges.length ? data.additionalCharges : undefined,
        tcsRate: computed.totals.tcsRate,
        tcsAmount: computed.totals.tcsAmount,
        tdsRate: computed.totals.tdsRate,
        tdsAmount: computed.totals.tdsAmount,
        reverseCharge: data.reverseCharge,
        ewayBillNo: data.ewayBillNo ?? null,
        transporterName: data.transporterName ?? null,
        vehicleNo: data.vehicleNo ?? null,
        transportDistanceKm: data.transportDistanceKm ?? null,
        termsConditions: data.termsConditions ?? null,
        roundOff: computed.totals.roundOff,
        grandTotal: computed.totals.grandTotal,
        lines: {
          create: data.lines.map((l, i) => {
            const c = computed.lines[i]!;
            return {
              lineNo: i + 1,
              itemId: l.itemId ?? null,
              description: l.description,
              hsnSac: l.hsnSac ?? null,
              qty: l.qty,
              unit: l.unit,
              rate: l.rate,
              discountPercent: l.discountPercent,
              taxRate: l.taxRate,
              cessRate: l.cessRate,
              taxInclusive: l.taxInclusive,
              taxable: c.taxable,
              cgst: c.cgst,
              sgst: c.sgst,
              igst: c.igst,
              cess: c.cess,
              lineTotal: c.lineTotal,
            };
          }),
        },
      },
      include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
    });

    // Sale reduces stock for product lines.
    await recordStock(businessId, invoice.id, data.lines, -1, "sale");

    return invoice;
  }
}

@Controller("invoices")
@UseGuards(SupabaseAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.invoices.list(user);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invoices.findOne(user, id);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createInvoiceSchema)) body: InvoiceBody) {
    return this.invoices.create(user, body);
  }
}

@Module({ controllers: [InvoicesController], providers: [InvoicesService] })
export class InvoicesModule {}
