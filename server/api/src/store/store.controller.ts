import { Controller, Get, Injectable, Module, NotFoundException, Param } from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaClient) {}

  async catalog(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true, name: true, phone: true, address: true },
    });
    if (!business) throw new NotFoundException({ error: "not_found" });

    const items = await this.prisma.item.findMany({
      where: { businessId: business.id, deletedAt: null, type: "product" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, salePrice: true, unit: true, taxRate: true },
    });

    return { business, items };
  }
}

// PUBLIC (no auth guard) — a shareable online catalog for a business.
@Controller("store")
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get(":businessId/catalog")
  catalog(@Param("businessId") businessId: string) {
    return this.store.catalog(businessId);
  }
}

@Module({ controllers: [StoreController], providers: [StoreService] })
export class StoreModule {}
