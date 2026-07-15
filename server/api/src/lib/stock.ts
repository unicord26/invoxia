import { prisma } from "@invoixe/db";

type LineRef = { itemId?: string | null; qty: number };

/**
 * Record stock movements for a transaction's product lines.
 * direction: -1 for sales (stock out), +1 for purchases (stock in).
 * Only lines linked to a product item affect stock (services and free-text lines don't).
 */
export async function recordStock(
  businessId: string,
  transactionId: string,
  lines: LineRef[],
  direction: 1 | -1,
  reason: string
): Promise<void> {
  const itemIds = lines.map((l) => l.itemId).filter((id): id is string => !!id);
  if (itemIds.length === 0) return;

  const products = await prisma.item.findMany({
    where: { id: { in: itemIds }, businessId, type: "product", deletedAt: null },
    select: { id: true },
  });
  const productSet = new Set(products.map((p) => p.id));

  const data = lines
    .filter((l) => l.itemId && productSet.has(l.itemId))
    .map((l) => ({
      businessId,
      itemId: l.itemId!,
      qty: direction * l.qty,
      reason,
      refTransactionId: transactionId,
    }));

  if (data.length) await prisma.stockMovement.createMany({ data });
}

/** Map of itemId -> current stock (openingStock + Σ movements). */
export async function getStockMap(businessId: string): Promise<Record<string, number>> {
  const items = await prisma.item.findMany({
    where: { businessId, deletedAt: null },
    select: { id: true, openingStock: true },
  });
  const moves = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: { businessId },
    _sum: { qty: true },
  });
  const map: Record<string, number> = {};
  for (const it of items) map[it.id] = it.openingStock;
  for (const m of moves) map[m.itemId] = (map[m.itemId] ?? 0) + (m._sum.qty ?? 0);
  return map;
}
