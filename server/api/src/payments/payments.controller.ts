import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, Post, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createPaymentSchema } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type PaymentBody = z.infer<typeof createPaymentSchema>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List money in/out. */
  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.transaction.findMany({
      where: { businessId, type: { in: ["payment_in", "payment_out"] }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { party: true },
    });
  }

  /** Record a payment against a party. */
  async create(user: AuthUser, data: PaymentBody) {
    const businessId = await getUserBusinessId(user);
    const party = await this.prisma.party.findFirst({
      where: { id: data.partyId, businessId, deletedAt: null },
    });
    if (!party) throw new BadRequestException({ error: "party_not_found" });

    const prefix = data.type === "payment_in" ? "PAY-IN" : "PAY-OUT";
    const num = await nextNumber(businessId, data.type, prefix);

    return this.prisma.transaction.create({
      data: {
        businessId,
        type: data.type,
        status: "final",
        number: num.number,
        series: num.series,
        seq: num.seq,
        partyId: party.id,
        partyName: party.name,
        partyGstin: party.gstin,
        paymentMode: data.paymentMode,
        referenceNo: data.referenceNo ?? null,
        date: data.date ?? new Date(),
        notes: data.notes ?? null,
        subTotal: data.amount,
        grandTotal: data.amount,
      },
      include: { party: true },
    });
  }
}

@Controller("payments")
@UseGuards(SupabaseAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.payments.list(user);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createPaymentSchema)) body: PaymentBody) {
    return this.payments.create(user, body);
  }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
