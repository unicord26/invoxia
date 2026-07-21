import { Controller, Get, Injectable, Module, Query, UseGuards } from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { signedBalanceDelta } from "../lib/ledger";
import { getStockMap } from "../lib/stock";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

type Bal = { name: string; type: string; balance: number; phone?: string | null };

function getRangeStartDate(range: string): Date | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch (range) {
    case "1D":
      return d;
    case "7D":
      d.setDate(d.getDate() - 7);
      return d;
    case "1M":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "1Y":
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case "5Y":
      d.setFullYear(d.getFullYear() - 5);
      return d;
    case "All":
    default:
      return null;
  }
}

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
    for (const p of parties) map[p.id] = { name: p.name, type: p.type, phone: p.phone, balance: p.openingBalance };
    for (const g of grouped) {
      if (!g.partyId || !map[g.partyId]) continue;
      map[g.partyId]!.balance += signedBalanceDelta(g.type, g._sum.grandTotal ?? 0);
    }
    return map;
  }

  /** Headline numbers for the home dashboard cards. */
  async dashboard(user: AuthUser, range = "1D") {
    const businessId = await getUserBusinessId(user);

    const startDate = getRangeStartDate(range);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [salesAgg, partiesCount, newPartiesCount, products, stockMap, bankEntries, bankAccounts] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: { 
            businessId, 
            deletedAt: null, 
            type: "sale", 
            ...(startDate ? { date: { gte: startDate } } : {}) 
          },
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
      todaySales: salesAgg._sum.grandTotal ?? 0,
      partiesCount,
      newPartiesThisWeek: newPartiesCount,
      itemsCount: products.length,
      lowStock,
      cashBank,
    };
  }

  /** Headline P&L + receivable/payable numbers. */
  async summary(user: AuthUser, monthOnly = false, range?: string) {
    const businessId = await getUserBusinessId(user);

    let startDate: Date | null = null;
    if (range) {
      startDate = getRangeStartDate(range);
    } else if (monthOnly) {
      startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    const agg = await this.prisma.transaction.groupBy({
      by: ["type"],
      where: {
        businessId,
        deletedAt: null,
        ...(startDate ? { date: { gte: startDate } } : {}),
      },
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
      include: { category: true },
      orderBy: { name: "asc" },
    });
    const map = await getStockMap(businessId);
    const rows = items.map((it) => {
      const qty = map[it.id] ?? it.openingStock;
      return {
        id: it.id,
        name: it.name,
        itemCode: it.itemCode,
        categoryName: it.category?.name ?? "General",
        unit: it.unit,
        qty,
        minStock: it.minStock,
        purchasePrice: it.purchasePrice,
        salePrice: it.salePrice,
        value: Math.round(qty * it.purchasePrice),
        low: qty <= it.minStock && it.minStock > 0,
      };
    });
    return { rows, totalValue: rows.reduce((s, r) => s + r.value, 0) };
  }

  /** GSTR-3B style output vs input summary. */
  async gst(user: AuthUser, range?: string) {
    const businessId = await getUserBusinessId(user);
    const startDate = range ? getRangeStartDate(range) : null;
    const agg = await this.prisma.transaction.groupBy({
      by: ["type"],
      where: {
        businessId,
        deletedAt: null,
        ...(startDate ? { date: { gte: startDate } } : {}),
      },
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
  async daybook(user: AuthUser, range?: string) {
    const businessId = await getUserBusinessId(user);
    const startDate = range ? getRangeStartDate(range) : null;
    return this.prisma.transaction.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(startDate ? { date: { gte: startDate } } : {}),
      },
      orderBy: { date: "desc" },
      take: 500,
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        dueDate: true,
        partyId: true,
        partyName: true,
        paymentMode: true,
        referenceNo: true,
        category: true,
        subTotal: true,
        totalTax: true,
        grandTotal: true,
      },
    });
  }

  /** Accurate real-time profitability & revenue/expense trend breakdown. */
  async trend(user: AuthUser, range: string) {
    const businessId = await getUserBusinessId(user);
    const startDate = getRangeStartDate(range);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        businessId,
        deletedAt: null,
        type: { in: ["sale", "purchase", "expense"] },
        ...(startDate ? { date: { gte: startDate } } : {}),
      },
      select: { type: true, grandTotal: true, subTotal: true, date: true },
      orderBy: { date: "asc" },
    });

    const now = new Date();
    interface PointInternal {
      label: string;
      sales: number;
      purchases: number;
      expenses: number;
      start: Date;
      end: Date;
    }
    const points: PointInternal[] = [];

    if (range === "1D") {
      for (let i = 7; i >= 0; i--) {
        const start = new Date(now.getTime() - (i + 1) * 3 * 60 * 60 * 1000);
        const end = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
        const label = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
        points.push({ label, sales: 0, purchases: 0, expenses: 0, start, end });
      }
    } else if (range === "7D") {
      for (let i = 6; i >= 0; i--) {
        const start = new Date();
        start.setDate(now.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        points.push({ label, sales: 0, purchases: 0, expenses: 0, start, end });
      }
    } else if (range === "1M") {
      for (let i = 29; i >= 0; i--) {
        const start = new Date();
        start.setDate(now.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        points.push({ label, sales: 0, purchases: 0, expenses: 0, start, end });
      }
    } else if (range === "1Y") {
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const label = start.toLocaleDateString(undefined, { month: "short" });
        points.push({ label, sales: 0, purchases: 0, expenses: 0, start, end });
      }
    } else {
      const years = 5;
      for (let i = years - 1; i >= 0; i--) {
        const start = new Date(now.getFullYear() - i, 0, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999);
        const label = start.toLocaleDateString(undefined, { year: "numeric" });
        points.push({ label, sales: 0, purchases: 0, expenses: 0, start, end });
      }
    }

    for (const tx of transactions) {
      const txTime = new Date(tx.date).getTime();
      const pt = points.find((p) => txTime >= p.start.getTime() && txTime <= p.end.getTime());
      if (pt) {
        if (tx.type === "sale") {
          pt.sales += tx.grandTotal;
        } else if (tx.type === "purchase") {
          pt.purchases += tx.grandTotal;
        } else if (tx.type === "expense") {
          pt.expenses += tx.grandTotal;
        }
      }
    }

    return points.map((p) => ({
      label: p.label,
      sales: p.sales,
      purchases: p.purchases,
      expenses: p.expenses,
      profit: p.sales - p.purchases - p.expenses, // Net profit or loss in paise
    }));
  }
}

@Controller("reports")
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthUser, @Query("range") range?: string) {
    return this.reports.dashboard(user, range);
  }

  @Get("summary")
  summary(
    @CurrentUser() user: AuthUser,
    @Query("monthOnly") monthOnly?: string,
    @Query("range") range?: string,
  ) {
    return this.reports.summary(user, monthOnly === "true", range);
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
  gst(@CurrentUser() user: AuthUser, @Query("range") range?: string) {
    return this.reports.gst(user, range);
  }

  @Get("daybook")
  daybook(@CurrentUser() user: AuthUser, @Query("range") range?: string) {
    return this.reports.daybook(user, range);
  }

  @Get("trend")
  trend(@CurrentUser() user: AuthUser, @Query("range") range?: string) {
    return this.reports.trend(user, range ?? "7D");
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
