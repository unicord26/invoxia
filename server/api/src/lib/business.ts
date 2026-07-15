import { prisma } from "@invoixe/db";
import type { AuthUser } from "./auth";

/**
 * Resolve the business the authenticated user operates on.
 * - Ensures a User row exists for the Supabase auth user.
 * - Finds their first membership, or provisions one on first login:
 *   adopts an existing orphan business (dev seed) or creates "My Business".
 */
export async function getUserBusinessId(authUser: AuthUser): Promise<string> {
  await prisma.user.upsert({
    where: { id: authUser.id },
    create: { id: authUser.id, email: authUser.email },
    update: { email: authUser.email },
  });

  // If the client selected a firm (x-business-id), honor it only if they're a member.
  if (authUser.requestedBusinessId) {
    const requested = await prisma.membership.findFirst({
      where: { userId: authUser.id, businessId: authUser.requestedBusinessId, deletedAt: null },
    });
    if (requested) return requested.businessId;
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: authUser.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (membership) return membership.businessId;

  let business = await prisma.business.findFirst({
    where: { deletedAt: null, memberships: { none: {} } },
    orderBy: { createdAt: "asc" },
  });
  if (!business) {
    business = await prisma.business.create({ data: { name: "My Business", stateCode: "27" } });
  }
  await prisma.membership.create({
    data: { userId: authUser.id, businessId: business.id, role: "owner" },
  });
  return business.id;
}

/** The user's role in a business, or null if not a member. */
export async function getUserRole(userId: string, businessId: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({ where: { userId, businessId, deletedAt: null } });
  return m?.role ?? null;
}
