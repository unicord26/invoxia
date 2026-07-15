import { Body, Controller, Get, HttpCode, Injectable, Module, Post, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createExpenseSchema } from "@invoixe/types";
import { computeLine } from "@invoixe/core";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { nextNumber } from "../lib/numbering";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type ExpenseBody = z.infer<typeof createExpenseSchema>;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.transaction.findMany({
      where: { businessId, type: "expense", deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { party: true },
    });
  }

  /** `amount` is treated as a tax-inclusive total. */
  async create(user: AuthUser, data: ExpenseBody) {
    const businessId = await getUserBusinessId(user);
    const party = data.partyId
      ? await this.prisma.party.findFirst({ where: { id: data.partyId, businessId, deletedAt: null } })
      : null;

    // Back out input GST from the inclusive amount (intra-state assumption for expenses).
    const c = computeLine({ qty: 1, rate: data.amount, taxRate: data.taxRate, taxInclusive: true }, false);

    const num = await nextNumber(businessId, "expense", "EXP");

    return this.prisma.transaction.create({
      data: {
        businessId, type: "expense", status: "final",
        number: num.number, series: num.series, seq: num.seq,
        partyId: party?.id ?? null, partyName: party?.name ?? null,
        category: data.category, paymentMode: data.paymentMode,
        date: data.date ?? new Date(), notes: data.notes ?? null,
        subTotal: c.taxable, cgst: c.cgst, sgst: c.sgst, cess: c.cess,
        totalTax: c.totalTax, grandTotal: data.amount,
      },
      include: { party: true },
    });
  }
}

@Controller("expenses")
@UseGuards(SupabaseAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.expenses.list(user);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createExpenseSchema)) body: ExpenseBody) {
    return this.expenses.create(user, body);
  }
}

@Module({ controllers: [ExpensesController], providers: [ExpensesService] })
export class ExpensesModule {}
