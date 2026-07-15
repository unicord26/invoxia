import {
  Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createLoanSchema, createLoanEntrySchema } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type LoanBody = z.infer<typeof createLoanSchema>;
type LoanEntryBody = z.infer<typeof createLoanEntrySchema>;

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Loan accounts (with entries) for the user's business. */
  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.loanAccount.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { entries: { orderBy: { date: "desc" } } },
    });
  }

  /** Open a loan; principal seeds the outstanding balance. */
  async create(user: AuthUser, data: LoanBody) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.loanAccount.create({
      data: { ...data, businessId, balance: data.principal },
    });
  }

  /**
   * Record an entry & adjust the balance atomically.
   * disbursement/charge increase the outstanding; emi reduces it (clamped at 0).
   */
  async addEntry(user: AuthUser, id: string, data: LoanEntryBody) {
    const businessId = await getUserBusinessId(user);
    const { amount, kind, date, note } = data;

    const result = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loanAccount.findFirst({ where: { id, businessId, deletedAt: null } });
      if (!loan) return null;
      const delta = kind === "emi" ? -amount : amount;
      const balance = Math.max(0, loan.balance + delta);
      await tx.loanEntry.create({
        data: { loanId: loan.id, amount, kind, date: date ?? new Date(), note: note ?? null },
      });
      return tx.loanAccount.update({
        where: { id: loan.id },
        data: { balance },
        include: { entries: { orderBy: { date: "desc" } } },
      });
    });

    if (!result) throw new NotFoundException({ error: "not_found" });
    return result;
  }

  async remove(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.loanAccount.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
  }
}

@Controller("loans")
@UseGuards(SupabaseAuthGuard)
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.loans.list(user);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createLoanSchema)) body: LoanBody) {
    return this.loans.create(user, body);
  }

  @Post(":id/entries")
  @HttpCode(201)
  addEntry(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createLoanEntrySchema)) body: LoanEntryBody
  ) {
    return this.loans.addEntry(user, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.loans.remove(user, id);
  }
}

@Module({ controllers: [LoansController], providers: [LoansService] })
export class LoansModule {}
