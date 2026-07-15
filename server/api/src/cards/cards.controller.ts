import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

const NETWORKS = ["visa", "mastercard", "rupay", "amex", "other"];
const KINDS = ["debit", "credit"];

interface CardBody {
  label?: string;
  network?: string;
  kind?: string;
  last4?: string;
  expiryLabel?: unknown;
  holderName?: unknown;
}

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Saved payment cards (PCI-safe reference data only). */
  async list(user: AuthUser) {
    const businessId = await getUserBusinessId(user);
    return this.prisma.paymentCard.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Save a card. We deliberately accept ONLY non-sensitive reference fields.
   * Any full card number or CVV in the body is ignored: storing them is
   * prohibited by PCI-DSS.
   */
  async create(user: AuthUser, body: CardBody) {
    const businessId = await getUserBusinessId(user);
    const { label, network, kind, last4, expiryLabel, holderName } = body ?? {};

    if (!label?.trim()) throw new BadRequestException({ error: "label_required" });
    // Keep digits only, then take the last 4 — so even if a full PAN is pasted we
    // never persist more than the last four.
    const digits = String(last4 ?? "").replace(/\D/g, "");
    if (digits.length < 4) throw new BadRequestException({ error: "last4_required" });

    const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

    return this.prisma.paymentCard.create({
      data: {
        businessId,
        label: String(label).trim(),
        network: network && NETWORKS.includes(network) ? network : "other",
        kind: kind && KINDS.includes(kind) ? kind : "debit",
        last4: digits.slice(-4),
        expiryLabel: clean(expiryLabel),
        holderName: clean(holderName),
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const card = await this.prisma.paymentCard.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!card) throw new NotFoundException({ error: "not_found" });
    await this.prisma.paymentCard.update({ where: { id: card.id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}

@Controller("cards")
@UseGuards(SupabaseAuthGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.cards.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CardBody) {
    return this.cards.create(user, body);
  }

  // Returns 200 {ok:true} rather than 204 — matches the existing client contract.
  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cards.remove(user, id);
  }
}

@Module({ controllers: [CardsController], providers: [CardsService] })
export class CardsModule {}
