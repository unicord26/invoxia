import { BadRequestException, Body, Controller, Get, Injectable, Module, Post, UseGuards } from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

interface CreateBusinessBody {
  name?: string;
  stateCode?: string;
}

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaClient) {}

  /** All firms the user belongs to, with their role. */
  async list(user: AuthUser) {
    // Ensure the user has at least one firm (provisions on first login).
    await getUserBusinessId(user);
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { business: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships
      .filter((m) => m.business && !m.business.deletedAt)
      .map((m) => ({ id: m.business.id, name: m.business.name, gstin: m.business.gstin, role: m.role }));
  }

  /** Create a new firm; the caller becomes its owner. */
  async create(user: AuthUser, body: CreateBusinessBody) {
    const name = body?.name?.trim();
    if (!name) throw new BadRequestException({ error: "name_required" });

    await this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email },
      update: {},
    });
    const business = await this.prisma.business.create({
      data: { name, stateCode: body?.stateCode || "27" },
    });
    await this.prisma.membership.create({ data: { userId: user.id, businessId: business.id, role: "owner" } });

    return { id: business.id, name: business.name, role: "owner" };
  }
}

@Controller("businesses")
@UseGuards(SupabaseAuthGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.businesses.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBusinessBody) {
    return this.businesses.create(user, body);
  }
}

@Module({ controllers: [BusinessesController], providers: [BusinessesService] })
export class BusinessesModule {}
