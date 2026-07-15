import { Router } from "express";
import { prisma } from "@invoixe/db";
import { getUserBusinessId } from "../lib/business";

export const bankRouter = Router();

async function balances(businessId: string) {
  const sums = await prisma.bankEntry.groupBy({
    by: ["accountId"],
    where: { businessId },
    _sum: { amount: true },
  });
  const map: Record<string, number> = {};
  for (const s of sums) map[s.accountId] = s._sum.amount ?? 0;
  return map;
}

// GET /api/bank — accounts with computed balances
bankRouter.get("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const [accounts, map] = await Promise.all([
    prisma.bankAccount.findMany({ where: { businessId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    balances(businessId),
  ]);
  res.json(accounts.map((a) => ({ ...a, balance: a.openingBalance + (map[a.id] ?? 0) })));
});

// GET /api/bank/entries — list recent bank transactions/entries
bankRouter.get("/entries", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const entries = await prisma.bankEntry.findMany({
    where: { businessId },
    orderBy: { date: "desc" },
    take: 100,
    include: { account: { select: { id: true, name: true, type: true } } },
  });
  res.json(entries);
});

// POST /api/bank — create an account
bankRouter.post("/", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { name, type, accountNo, ifsc, bankName, branch, holderName, upiId, openingBalance } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "name_required" });
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const account = await prisma.bankAccount.create({
    data: {
      businessId,
      name: String(name).trim(),
      type: ["bank", "cash", "upi"].includes(type) ? type : "bank",
      accountNo: clean(accountNo),
      ifsc: clean(ifsc),
      bankName: clean(bankName),
      branch: clean(branch),
      holderName: clean(holderName),
      upiId: clean(upiId),
      openingBalance: Number.isInteger(openingBalance) ? openingBalance : 0,
    },
  });
  res.status(201).json(account);
});

// POST /api/bank/:id/entry — deposit (+) or withdraw (-)
bankRouter.post("/:id/entry", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const amount = Number(req.body?.amount);
  const kind = req.body?.kind === "withdraw" ? "withdraw" : "deposit";
  if (!Number.isInteger(amount) || amount === 0) return res.status(400).json({ error: "invalid_amount" });
  const account = await prisma.bankAccount.findFirst({ where: { id: req.params.id, businessId, deletedAt: null } });
  if (!account) return res.status(404).json({ error: "not_found" });
  const signed = kind === "withdraw" ? -Math.abs(amount) : Math.abs(amount);
  await prisma.bankEntry.create({ data: { businessId, accountId: account.id, amount: signed, kind, note: req.body?.note ?? null } });
  res.status(201).json({ ok: true });
});

// POST /api/bank/transfer — move money between two accounts
bankRouter.post("/transfer", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const { fromId, toId } = req.body ?? {};
  const amount = Math.abs(Number(req.body?.amount));
  if (!fromId || !toId || fromId === toId || !Number.isInteger(amount) || amount === 0) {
    return res.status(400).json({ error: "invalid_transfer" });
  }
  const accounts = await prisma.bankAccount.findMany({ where: { id: { in: [fromId, toId] }, businessId, deletedAt: null } });
  if (accounts.length !== 2) return res.status(404).json({ error: "account_not_found" });
  await prisma.bankEntry.createMany({
    data: [
      { businessId, accountId: fromId, amount: -amount, kind: "transfer_out", note: `Transfer to ${toId}` },
      { businessId, accountId: toId, amount, kind: "transfer_in", note: `Transfer from ${fromId}` },
    ],
  });
  res.status(201).json({ ok: true });
});
