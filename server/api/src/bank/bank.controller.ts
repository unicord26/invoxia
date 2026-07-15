import {
  BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

interface CreateAccountBody {
  name?: string;
  type?: string;
  accountNo?: unknown;
  ifsc?: unknown;
  bankName?: unknown;
  branch?: unknown;
  holderName?: unknown;
  upiId?: unknown;
  openingBalance?: unknown;
}

interface EntryBody {
  amount?: unknown;
  kind?: unknown;
  note?: string | null;
}

interface TransferBody {
  fromId?: string;
  toId?: string;
  amount?: unknown;
}

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaClient) {}

  private async balances(businessId: string) {
    const sums = await this.prisma.bankEntry.groupBy({
      by: ["accountId"],
      where: { businessId },
      _sum: { amount: true },
    });
    const map: Record<string, number> = {};
    for (const s of sums) map[s.accountId] = s._sum.amount ?? 0;
    return map;
  }

  /** Accounts with computed balances. */
  async accounts(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const [accounts, map] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { businessId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
      this.balances(businessId),
    ]);
    return accounts.map((a) => ({ ...a, balance: a.openingBalance + (map[a.id] ?? 0) }));
  }

  /** Recent bank transactions/entries. */
  async entries(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.bankEntry.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
      take: 100,
      include: { account: { select: { id: true, name: true, type: true } } },
    });
  }

  async createAccount(user: AuthUser, body: CreateAccountBody) {
    const businessId = await getUserBusinessId(user);
    const { name, type, accountNo, ifsc, bankName, branch, holderName, upiId, openingBalance } = body ?? {};
    if (!name?.trim()) throw new BadRequestException({ error: "name_required" });

    return this.prisma.bankAccount.create({
      data: {
        businessId,
        name: String(name).trim(),
        type: typeof type === "string" && ["bank", "cash", "upi"].includes(type) ? type : "bank",
        accountNo: clean(accountNo),
        ifsc: clean(ifsc),
        bankName: clean(bankName),
        branch: clean(branch),
        holderName: clean(holderName),
        upiId: clean(upiId),
        openingBalance: Number.isInteger(openingBalance) ? (openingBalance as number) : 0,
      },
    });
  }

  /** Deposit (+) or withdraw (-). */
  async addEntry(user: AuthUser, id: string, body: EntryBody) {
    const businessId = await getUserBusinessId(user);
    const amount = Number(body?.amount);
    const kind = body?.kind === "withdraw" ? "withdraw" : "deposit";
    if (!Number.isInteger(amount) || amount === 0) throw new BadRequestException({ error: "invalid_amount" });

    const account = await this.prisma.bankAccount.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!account) throw new NotFoundException({ error: "not_found" });

    const signed = kind === "withdraw" ? -Math.abs(amount) : Math.abs(amount);
    await this.prisma.bankEntry.create({
      data: { businessId, accountId: account.id, amount: signed, kind, note: body?.note ?? null },
    });
    return { ok: true };
  }

  /** Move money between two accounts. */
  async transfer(user: AuthUser, body: TransferBody) {
    const businessId = await getUserBusinessId(user);
    const { fromId, toId } = body ?? {};
    const amount = Math.abs(Number(body?.amount));
    if (!fromId || !toId || fromId === toId || !Number.isInteger(amount) || amount === 0) {
      throw new BadRequestException({ error: "invalid_transfer" });
    }

    const accounts = await this.prisma.bankAccount.findMany({
      where: { id: { in: [fromId, toId] }, businessId, deletedAt: null },
    });
    if (accounts.length !== 2) throw new NotFoundException({ error: "account_not_found" });

    await this.prisma.bankEntry.createMany({
      data: [
        { businessId, accountId: fromId, amount: -amount, kind: "transfer_out", note: `Transfer to ${toId}` },
        { businessId, accountId: toId, amount, kind: "transfer_in", note: `Transfer from ${fromId}` },
      ],
    });
    return { ok: true };
  }
}

@Controller("bank")
@UseGuards(SupabaseAuthGuard)
export class BankController {
  constructor(private readonly bank: BankService) {}

  @Get()
  accounts(@CurrentUser() user: AuthUser) {
    return this.bank.accounts(user);
  }

  @Get("entries")
  entries(@CurrentUser() user: AuthUser) {
    return this.bank.entries(user);
  }

  @Post()
  @HttpCode(201)
  createAccount(@CurrentUser() user: AuthUser, @Body() body: CreateAccountBody) {
    return this.bank.createAccount(user, body);
  }

  // Declared before ":id/entry" so the literal path wins the match.
  @Post("transfer")
  @HttpCode(201)
  transfer(@CurrentUser() user: AuthUser, @Body() body: TransferBody) {
    return this.bank.transfer(user, body);
  }

  @Post(":id/entry")
  @HttpCode(201)
  addEntry(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: EntryBody) {
    return this.bank.addEntry(user, id, body);
  }
}

@Module({ controllers: [BankController], providers: [BankService] })
export class BankModule {}
