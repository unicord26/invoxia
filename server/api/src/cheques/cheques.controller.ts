import {
  Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { PrismaClient } from "@invoixe/db";
import { createChequeSchema, chequeStatusUpdateSchema } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

type ChequeBody = z.infer<typeof createChequeSchema>;
type ChequeStatusBody = z.infer<typeof chequeStatusUpdateSchema>;

@Injectable()
export class ChequesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.cheque.findMany({
      where: { businessId, deletedAt: null },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
  }

  async create(user: AuthUser, data: ChequeBody) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.cheque.create({ data: { ...data, businessId } });
  }

  /** Advance the cheque lifecycle, scoped to the user's business. */
  async setStatus(user: AuthUser, id: string, data: ChequeStatusBody) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.cheque.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { status: data.status },
    });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
    return this.prisma.cheque.findUnique({ where: { id } });
  }

  async remove(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const { count } = await this.prisma.cheque.updateMany({
      where: { id, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException({ error: "not_found" });
  }
}

@Controller("cheques")
@UseGuards(SupabaseAuthGuard)
export class ChequesController {
  constructor(private readonly cheques: ChequesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.cheques.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createChequeSchema)) body: ChequeBody) {
    return this.cheques.create(user, body);
  }

  @Patch(":id/status")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(chequeStatusUpdateSchema)) body: ChequeStatusBody
  ) {
    return this.cheques.setStatus(user, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cheques.remove(user, id);
  }
}

@Module({ controllers: [ChequesController], providers: [ChequesService] })
export class ChequesModule {}
