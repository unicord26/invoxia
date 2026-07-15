import { Body, Controller, Get, HttpCode, Injectable, Module, Post, UseGuards } from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import { createPartySchema, createItemSchema } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

interface ImportBody {
  parties?: unknown;
  items?: unknown;
}

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Full JSON snapshot of the current business. */
  async snapshot(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    const [business, parties, items, categories, transactions, movements, bankAccounts, bankEntries] =
      await Promise.all([
        this.prisma.business.findUnique({ where: { id: businessId } }),
        this.prisma.party.findMany({ where: { businessId, deletedAt: null } }),
        this.prisma.item.findMany({ where: { businessId, deletedAt: null } }),
        this.prisma.itemCategory.findMany({ where: { businessId, deletedAt: null } }),
        this.prisma.transaction.findMany({ where: { businessId, deletedAt: null }, include: { lines: true } }),
        this.prisma.stockMovement.findMany({ where: { businessId } }),
        this.prisma.bankAccount.findMany({ where: { businessId, deletedAt: null } }),
        this.prisma.bankEntry.findMany({ where: { businessId } }),
      ]);

    return {
      // Format marker kept as-is: backups already exported by users carry this
      // key, and renaming it would break restoring them.
      _leafxBackup: 1,
      exportedAt: new Date().toISOString(),
      business,
      parties, items, categories, transactions, movements, bankAccounts, bankEntries,
    };
  }

  /** Bulk-create parties and/or items from arrays (CSV/JSON upload). */
  async import(user: AuthUser, body: ImportBody) {
    const businessId = await getUserBusinessId(user);
    const partyBody = createPartySchema.omit({ businessId: true });
    const itemBody = createItemSchema.omit({ businessId: true });

    const inParties: unknown[] = Array.isArray(body?.parties) ? body.parties : [];
    const inItems: unknown[] = Array.isArray(body?.items) ? body.items : [];

    // Invalid rows are skipped, not fatal — the client reports the skipped count.
    const goodParties = inParties
      .map((p) => partyBody.safeParse(p))
      .filter((r) => r.success)
      .map((r) => ({ ...r.data, businessId }));
    const goodItems = inItems
      .map((i) => itemBody.safeParse(i))
      .filter((r) => r.success)
      .map((r) => ({ ...r.data, businessId }));

    if (goodParties.length) await this.prisma.party.createMany({ data: goodParties });
    if (goodItems.length) await this.prisma.item.createMany({ data: goodItems });

    return {
      partiesImported: goodParties.length,
      partiesSkipped: inParties.length - goodParties.length,
      itemsImported: goodItems.length,
      itemsSkipped: inItems.length - goodItems.length,
    };
  }
}

@Controller("backup")
@UseGuards(SupabaseAuthGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  snapshot(@CurrentUser() user: AuthUser) {
    return this.backup.snapshot(user);
  }

  @Post("import")
  @HttpCode(201)
  import(@CurrentUser() user: AuthUser, @Body() body: ImportBody) {
    return this.backup.import(user, body);
  }
}

@Module({ controllers: [BackupController], providers: [BackupService] })
export class BackupModule {}
