import { Router } from "express";
import { prisma } from "@invoixe/db";
import { supabaseAdmin } from "../lib/supabase";

// PUBLIC auth router (no requireAuth).
export const authRouter = Router();

const OTP_TTL_MIN = 10;
const gen6 = () => String(Math.floor(100000 + Math.random() * 900000));

// POST /api/auth/username-available
authRouter.post("/username-available", async (req, res) => {
  const username = String(req.body?.username ?? "").trim().toLowerCase();
  if (username.length < 3) return res.json({ available: false, reason: "too_short" });
  const existing = await prisma.user.findFirst({ where: { username } });
  res.json({ available: !existing });
});

// POST /api/auth/otp/send { channel: "phone"|"email", value }
// DEV MODE: the code is returned in the response so the flow works without an
// SMS/SMTP provider. In production, send it via provider and DO NOT return devCode.
authRouter.post("/otp/send", async (req, res) => {
  const channel = req.body?.channel === "phone" ? "phone" : "email";
  const value = String(req.body?.value ?? "").trim();
  if (!value) return res.status(400).json({ error: "value_required" });
  const code = gen6();
  await prisma.otpCode.create({
    data: { channel, value, code, expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
  });
  // TODO(prod): send `code` via SMS (phone) or email (SMTP) here instead of returning it.
  res.json({ sent: true, devCode: code });
});

// POST /api/auth/otp/verify { channel, value, code }
authRouter.post("/otp/verify", async (req, res) => {
  const channel = req.body?.channel === "phone" ? "phone" : "email";
  const value = String(req.body?.value ?? "").trim();
  const code = String(req.body?.code ?? "").trim();
  const otp = await prisma.otpCode.findFirst({
    where: { channel, value, code, verifiedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return res.status(400).json({ verified: false, error: "invalid_or_expired" });
  await prisma.otpCode.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
  res.json({ verified: true });
});

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  const b = req.body ?? {};
  const firstName = String(b.firstName ?? "").trim();
  const lastName = String(b.lastName ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const username = String(b.username ?? "").trim().toLowerCase();
  const orgType = String(b.orgType ?? "").trim();
  const orgName = String(b.orgName ?? "").trim();
  const password = String(b.password ?? "");

  if (!firstName || !username || !email || !orgName || password.length < 6) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (await prisma.user.findFirst({ where: { username } })) {
    return res.status(409).json({ error: "username_taken" });
  }

  // Create a PRE-CONFIRMED Supabase auth user (no email verification).
  // email_confirm:true means the account is active immediately and login works
  // without any confirmation email.
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { firstName, lastName, phone },
  });
  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? "auth_create_failed";
    const code = /already.*registered|already been|exists/i.test(msg) ? "email_taken" : msg;
    return res.status(400).json({ error: code });
  }
  const uid = created.data.user.id;

  await prisma.user.create({
    data: { id: uid, username, email, phone: phone || null, firstName, lastName, name: `${firstName} ${lastName}`.trim() },
  });
  const business = await prisma.business.create({ data: { name: orgName, orgType: orgType || null, stateCode: "27" } });
  await prisma.membership.create({ data: { userId: uid, businessId: business.id, role: "owner" } });

  res.status(201).json({ ok: true });
});

// POST /api/auth/login { username, password } -> Supabase session
authRouter.post("/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user?.email) return res.status(401).json({ error: "invalid_credentials" });

  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  });
  const data = (await r.json()) as { access_token?: string; refresh_token?: string };
  if (!r.ok || !data.access_token) return res.status(401).json({ error: "invalid_credentials" });
  res.json({ access_token: data.access_token, refresh_token: data.refresh_token });
});
