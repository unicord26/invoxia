import "./lib/env"; // must be first — loads .env before Prisma/Supabase read it
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { prisma } from "@invoixe/db";
import { partiesRouter } from "./routes/parties";
import { itemsRouter } from "./routes/items";
import { invoicesRouter } from "./routes/invoices";
import { paymentsRouter } from "./routes/payments";
import { purchasesRouter } from "./routes/purchases";
import { expensesRouter } from "./routes/expenses";
import { documentsRouter } from "./routes/documents";
import { bankRouter } from "./routes/bank";
import { cardsRouter } from "./routes/cards";
import { chequesRouter } from "./routes/cheques";
import { loansRouter } from "./routes/loans";
import { reportsRouter } from "./routes/reports";
import { gstRouter } from "./routes/gst";
import { manufacturingRouter } from "./routes/manufacturing";
import { businessRouter } from "./routes/business";
import { businessesRouter } from "./routes/businesses";
import { storeRouter } from "./routes/store";
import { backupRouter } from "./routes/backup";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./lib/auth";

const app = express();

// Security headers (CSP is left to the Next app; this is a JSON API).
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// CORS: restrict to the known frontend origin(s). Set FRONTEND_ORIGINS (comma-
// separated) in production; defaults cover local dev.
const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / non-browser (curl, server-to-server) requests with no Origin.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
  })
);

// Cap request bodies — bulk import is the largest legitimate payload.
app.use(express.json({ limit: "2mb" }));

// Blanket rate limit (generous; blunts abuse without hindering normal use).
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  })
);

/** Ping Supabase Postgres (via Prisma) — the meaningful backend-connectivity signal. */
async function supabaseHealth(): Promise<{ db: "connected" | "error"; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { db: "connected", latencyMs: Date.now() - started };
  } catch (e) {
    return { db: "error", latencyMs: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

// Public — reports Supabase connectivity so the client can verify the full chain.
app.get("/api/health", async (_req, res) => {
  const supabase = await supabaseHealth();
  res.status(supabase.db === "connected" ? 200 : 503).json({
    ok: supabase.db === "connected",
    service: "invoixe-api",
    supabase,
    time: new Date().toISOString(),
  });
});
// Tighter limit on auth endpoints (credential stuffing / brute-force defense).
const authLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "rate_limited" } });
app.use("/api/store", storeRouter); // public online catalog
app.use("/api/auth", authLimiter, authRouter); // public: register, username login, OTP

// Everything below requires a valid Supabase session
app.use("/api/business", requireAuth, businessRouter);
app.use("/api/businesses", requireAuth, businessesRouter);
app.use("/api/backup", requireAuth, backupRouter);
app.use("/api/parties", requireAuth, partiesRouter);
app.use("/api/items", requireAuth, itemsRouter);
app.use("/api/invoices", requireAuth, invoicesRouter);
app.use("/api/payments", requireAuth, paymentsRouter);
app.use("/api/purchases", requireAuth, purchasesRouter);
app.use("/api/expenses", requireAuth, expensesRouter);
app.use("/api/documents", requireAuth, documentsRouter);
app.use("/api/bank", requireAuth, bankRouter);
app.use("/api/cards", requireAuth, cardsRouter);
app.use("/api/cheques", requireAuth, chequesRouter);
app.use("/api/loans", requireAuth, loansRouter);
app.use("/api/reports", requireAuth, reportsRouter);
app.use("/api/gst", requireAuth, gstRouter);
app.use("/api", requireAuth, manufacturingRouter); // /api/bom, /api/production, /api/godowns

const PORT = Number(process.env.API_PORT ?? 5000);
const server = app.listen(PORT, async () => {
  console.log(`✓ Invoixe API listening on http://localhost:${PORT}`);
  // Startup handshake: confirm the Supabase connection before serving traffic.
  const sb = await supabaseHealth();
  if (sb.db === "connected") {
    console.log(`✓ Supabase Postgres connected (${sb.latencyMs}ms) — API ready`);
  } else {
    console.error(`✗ Supabase Postgres UNREACHABLE: ${sb.error}`);
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n✗ Port ${PORT} is already in use — an old API process is still holding it.\n` +
        `  Run \`npm run dev:clean\` from the repo root to free it, then start again.\n`
    );
    process.exit(1);
  }
  throw err;
});

// tsx watch restarts by signalling this process; release the port so the next
// start doesn't hit EADDRINUSE against our own previous run.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
