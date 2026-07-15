import { prisma } from "@invoixe/db";

/**
 * Atomically reserve the next number in a business's series.
 * Uses an upsert + increment inside a transaction so concurrent invoices
 * never collide (the @@unique([businessId, key]) row is the lock point).
 */
export async function nextNumber(
  businessId: string,
  key = "sale",
  prefix = "INV"
): Promise<{ series: string; seq: number; number: string }> {
  return prisma.$transaction(async (tx) => {
    const series = await tx.numberSeries.upsert({
      where: { businessId_key: { businessId, key } },
      create: { businessId, key, prefix, next: 2 }, // reserve seq 1, next becomes 2
      update: { next: { increment: 1 } }, // reserve current, bump next
    });
    // `next` is always the value AFTER this reservation, so the seq we just took is next-1.
    const seq = series.next - 1;
    return { series: series.prefix, seq, number: `${series.prefix}-${seq}` };
  });
}
