import {
  BadRequestException, Body, ConflictException, Controller, HttpCode, Injectable, MiddlewareConsumer, Module,
  NestModule, Post, UnauthorizedException,
} from "@nestjs/common";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@invoixe/db";
import { supabaseAdmin } from "../lib/supabase";

const OTP_TTL_MIN = 10;
const gen6 = () => String(Math.floor(100000 + Math.random() * 900000));

interface UsernameBody { username?: string }
interface OtpSendBody { channel?: string; value?: string }
interface OtpVerifyBody { channel?: string; value?: string; code?: string }
interface LoginBody { username?: string; password?: string }
interface RegisterBody {
  firstName?: string; lastName?: string; phone?: string; email?: string;
  username?: string; orgType?: string; orgName?: string; password?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async usernameAvailable(body: UsernameBody) {
    const username = String(body?.username ?? "").trim().toLowerCase();
    if (username.length < 3) return { available: false, reason: "too_short" };
    const existing = await this.prisma.user.findFirst({ where: { username } });
    return { available: !existing };
  }

  /**
   * Issue an OTP.
   *
   * The code is only echoed back when OTP_DEV_MODE=true, which is meant for
   * local work without an SMS/SMTP provider. Returning it unconditionally
   * (as this used to) means anyone can request a code for someone else's
   * address and read it straight out of the response — the OTP stops proving
   * anything at all. It now stays server-side unless dev mode is switched on
   * explicitly, and never in production.
   */
  async otpSend(body: OtpSendBody) {
    const channel = body?.channel === "phone" ? "phone" : "email";
    const value = String(body?.value ?? "").trim();
    if (!value) throw new BadRequestException({ error: "value_required" });

    const code = gen6();
    await this.prisma.otpCode.create({
      data: { channel, value, code, expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
    });

    const devMode = process.env.OTP_DEV_MODE === "true" && process.env.NODE_ENV !== "production";
    if (devMode) {
      console.log(`[otp] ${channel}=${value} code=${code} (OTP_DEV_MODE)`);
      return { sent: true, devCode: code };
    }

    // TODO(prod): deliver `code` via SMS (phone) or email (SMTP) here. Until a
    // provider is wired up, non-dev callers get no way to read the code — which
    // is the safe failure, not a silent leak.
    return { sent: true };
  }

  async otpVerify(body: OtpVerifyBody) {
    const channel = body?.channel === "phone" ? "phone" : "email";
    const value = String(body?.value ?? "").trim();
    const code = String(body?.code ?? "").trim();

    const otp = await this.prisma.otpCode.findFirst({
      where: { channel, value, code, verifiedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) throw new BadRequestException({ verified: false, error: "invalid_or_expired" });

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
    return { verified: true };
  }

  async register(body: RegisterBody) {
    const b = body ?? {};
    const firstName = String(b.firstName ?? "").trim();
    const lastName = String(b.lastName ?? "").trim();
    const phone = String(b.phone ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const username = String(b.username ?? "").trim().toLowerCase();
    const orgType = String(b.orgType ?? "").trim();
    const orgName = String(b.orgName ?? "").trim();
    const password = String(b.password ?? "");

    if (!firstName || !username || !email || !orgName || password.length < 6) {
      throw new BadRequestException({ error: "missing_fields" });
    }
    // Check every unique column up front, not just username. User.phone and
    // User.email are @unique too, and a collision discovered *after* the auth
    // user exists is what strands the account (see the rollback below).
    if (await this.prisma.user.findFirst({ where: { username } })) {
      throw new ConflictException({ error: "username_taken" });
    }
    if (await this.prisma.user.findFirst({ where: { email } })) {
      throw new ConflictException({ error: "email_taken" });
    }
    if (phone && (await this.prisma.user.findFirst({ where: { phone } }))) {
      throw new ConflictException({ error: "phone_taken" });
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
      throw new BadRequestException({ error: code });
    }
    const uid = created.data.user.id;

    // The auth user now exists but the app rows do not. If anything below fails
    // we must undo it: an auth user with no User row can neither log in (login
    // looks the user up by username and finds nothing) nor register again
    // (Supabase reports the email as taken) — the address is burned and the
    // person is locked out for good. The checks above catch the common races;
    // this rollback covers the rest (concurrent signup, DB blip).
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: uid, username, email, phone: phone || null, firstName, lastName,
            name: `${firstName} ${lastName}`.trim(),
          },
        });
        const business = await tx.business.create({
          data: { name: orgName, orgType: orgType || null, stateCode: "27" },
        });
        await tx.membership.create({ data: { userId: uid, businessId: business.id, role: "owner" } });
      });
    } catch (e) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {
        // Nothing else to try; log loudly so the orphan can be reaped by hand.
        console.error(`✗ Orphaned Supabase auth user ${uid} (${email}) — rollback failed`);
      });
      throw new ConflictException({ error: "registration_failed" });
    }

    return { ok: true };
  }

  /** Username + password -> Supabase session. */
  async login(body: LoginBody) {
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const user = await this.prisma.user.findFirst({ where: { username } });
    if (!user?.email) throw new UnauthorizedException({ error: "invalid_credentials" });

    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    });
    const data = (await r.json()) as { access_token?: string; refresh_token?: string };
    if (!r.ok || !data.access_token) throw new UnauthorizedException({ error: "invalid_credentials" });

    return { access_token: data.access_token, refresh_token: data.refresh_token };
  }
}

// PUBLIC (no SupabaseAuthGuard) — register, username login, OTP.
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("username-available")
  @HttpCode(200)
  usernameAvailable(@Body() body: UsernameBody) {
    return this.auth.usernameAvailable(body);
  }

  @Post("otp/send")
  @HttpCode(200)
  otpSend(@Body() body: OtpSendBody) {
    return this.auth.otpSend(body);
  }

  @Post("otp/verify")
  @HttpCode(200)
  otpVerify(@Body() body: OtpVerifyBody) {
    return this.auth.otpVerify(body);
  }

  @Post("register")
  @HttpCode(201)
  register(@Body() body: RegisterBody) {
    return this.auth.register(body);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() body: LoginBody) {
    return this.auth.login(body);
  }
}

@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Tighter limit than the global one (credential stuffing / brute-force defense).
    consumer
      .apply(
        rateLimit({
          windowMs: 60_000,
          limit: 30,
          standardHeaders: "draft-7",
          legacyHeaders: false,
          message: { error: "rate_limited" },
        })
      )
      .forRoutes(AuthController);
  }
}
