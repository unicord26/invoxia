import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { signedBalanceDelta } from "../lib/ledger";
import { getStockMap } from "../lib/stock";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

type Bal = { name: string; type: string; balance: number };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaClient) {}

  private async partyBalances(businessId: string): Promise<Record<string, Bal>> {
    const parties = await this.prisma.party.findMany({ where: { businessId, deletedAt: null } });
    const grouped = await this.prisma.transaction.groupBy({
      by: ["partyId", "type"],
      where: { businessId, deletedAt: null, partyId: { not: null } },
      _sum: { grandTotal: true },
    });
    const map: Record<string, Bal> = {};
    for (const p of parties) map[p.id] = { name: p.name, type: p.type, balance: p.openingBalance };
    for (const g of grouped) {
      if (!g.partyId || !map[g.partyId]) continue;
      map[g.partyId]!.balance += signedBalanceDelta(g.type, g._sum.grandTotal ?? 0);
    }
    return map;
  }

  /** Headline numbers for the home dashboard cards. */
  async dashboard(user: AuthUser) {
    const businessId = await getUserBusinessId(user);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [todaySalesAgg, partiesCount, newPartiesCount, products, stockMap, bankEntries, bankAccounts] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: { businessId, deletedAt: null, type: "sale", date: { gte: startOfToday } },
          _sum: { grandTotal: true },
        }),
        this.prisma.party.count({ where: { businessId, deletedAt: null } }),
        this.prisma.party.count({ where: { businessId, deletedAt: null, createdAt: { gte: startOfWeek } } }),
        this.prisma.item.findMany({
          where: { businessId, deletedAt: null, type: "product" },
          select: { id: true, openingStock: true, minStock: true },
        }),
        getStockMap(businessId),
        this.prisma.bankEntry.groupBy({ by: ["accountId"], where: { businessId }, _sum: { amount: true } }),
        this.prisma.bankAccount.findMany({
          where: { businessId, deletedAt: null },
          select: { id: true, openingBalance: true },
        }),
      ]);

    // low-stock count
    let lowStock = 0;
    for (const it of products) {
      const qty = stockMap[it.id] ?? it.openingStock;
      if (it.minStock > 0 && qty <= it.minStock) lowStock++;
    }

    // cash & bank total
    const entryMap: Record<string, number> = {};
    for (const e of bankEntries) entryMap[e.accountId] = e._sum.amount ?? 0;
    const cashBank = bankAccounts.reduce((sum, a) => sum + a.openingBalance + (entryMap[a.id] ?? 0), 0);

    return {
      todaySales: todaySalesAgg._sum.grandTotal ?? 0,
      partiesCount,
      newPartiesThisWeek: newPartiesCount,
      itemsCount: products.length,
      lowStock,
      cashBank,
    };
  }

  /** Headline P&L + receivable/payable numbers. */
  async summary(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const agg = await this.prisma.transaction.groupBy({
      by: ["type"],
      where: { businessId, deletedAt: null },
      _sum: { grandTotal: true, subTotal: true, totalTax: true },
    });
    type Sums = { grandTotal: number | null; subTotal: number | null; totalTax: number | null };
    const by = (t: string): Partial<Sums> => agg.find((a) => a.type === t)?._sum ?? {};
    const sale = by("sale"), pur = by("purchase"), exp = by("expense");

    const balances = await this.partyBalances(businessId);
    let receivables = 0, payables = 0;
    for (const k of Object.keys(balances)) {
      const b = balances[k]!.balance;
      if (b > 0) receivables += b; else payables += -b;
    }

    return {
      sales: sale.grandTotal ?? 0,
      purchases: pur.grandTotal ?? 0,
      expenses: exp.grandTotal ?? 0,
      outputTax: sale.totalTax ?? 0,
      inputTax: (pur.totalTax ?? 0) + (exp.totalTax ?? 0),
      grossProfit: (sale.subTotal ?? 0) - (pur.subTotal ?? 0) - (exp.subTotal ?? 0),
      receivables,
      payables,
    };
  }

  /** Party-wise receivables/payables. */
  async outstanding(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const balances = await this.partyBalances(businessId);
    return Object.entries(balances)
      .map(([id, v]) => ({ id, ...v }))
      .filter((r) => r.balance !== 0)
      .sort((a, b) => b.balance - a.balance);
  }

  /** Stock summary with valuation (qty × purchase price). */
  async stock(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const items = await this.prisma.item.findMany({
      where: { businessId, deletedAt: null, type: "product" },
      orderBy: { name: "asc" },
    });
    const map = await getStockMap(businessId);
    const rows = items.map((it) => {
      const qty = map[it.id] ?? it.openingStock;
      return {
        id: it.id, name: it.name, unit: it.unit, qty, minStock: it.minStock,
        value: Math.round(qty * it.purchasePrice),
        low: qty <= it.minStock && it.minStock > 0,
      };
    });
    return { rows, totalValue: rows.reduce((s, r) => s + r.value, 0) };
  }

  /** GSTR-3B style output vs input summary. */
  async gst(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const agg = await this.prisma.transaction.groupBy({
      by: ["type"],
      where: { businessId, deletedAt: null },
      _sum: { cgst: true, sgst: true, igst: true, totalTax: true, subTotal: true },
    });
    type GstSums = {
      cgst: number | null; sgst: number | null; igst: number | null;
      totalTax: number | null; subTotal: number | null;
    };
    const by = (t: string): Partial<GstSums> => agg.find((a) => a.type === t)?._sum ?? {};
    const sale = by("sale"), pur = by("purchase"), exp = by("expense");
    const outputTax = sale.totalTax ?? 0;
    const inputTax = (pur.totalTax ?? 0) + (exp.totalTax ?? 0);
    return {
      output: {
        taxable: sale.subTotal ?? 0, cgst: sale.cgst ?? 0, sgst: sale.sgst ?? 0,
        igst: sale.igst ?? 0, total: outputTax,
      },
      input: { cgst: pur.cgst ?? 0, sgst: pur.sgst ?? 0, igst: pur.igst ?? 0, total: inputTax },
      netPayable: outputTax - inputTax,
    };
  }

  /** All transactions, newest first. */
  async daybook(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.transaction.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { date: "desc" },
      take: 200,
      select: { id: true, type: true, number: true, date: true, partyName: true, grandTotal: true },
    });
  }
}

@Controller("reports")
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.reports.summary(user);
  }

  @Get("outstanding")
  outstanding(@CurrentUser() user: AuthUser) {
    return this.reports.outstanding(user);
  }

  @Get("stock")
  stock(@CurrentUser() user: AuthUser) {
    return this.reports.stock(user);
  }

  @Get("gst")
  gst(@CurrentUser() user: AuthUser) {
    return this.reports.gst(user);
  }

  @Get("daybook")
  daybook(@CurrentUser() user: AuthUser) {
    return this.reports.daybook(user);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
