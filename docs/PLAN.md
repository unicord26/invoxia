# Leafx — GST Billing, Accounting & Inventory Platform (Vyapar-class)

> **Positioning:** A functionally-complete alternative to Vyapar for Indian SMEs.
> We replicate *capabilities*, not code/UI/brand. All code, design, and assets are original to Leafx.
> **Decisions locked:** Web + Mobile together · **Full Vyapar feature parity** · Online-only for v1 (offline sync = dedicated later phase).

---

## 1. Brand & Theme — Leafx

**Name:** Leafx  ·  **Primary:** Green (growth, money, "leaf")  ·  **Secondary:** Red (accents, alerts, destructive).

> Rule of thumb: **Green is the dominant brand color** (buttons, active states, headers, positive money). **Red is used sparingly** — destructive actions, overdue/payable dues, errors, alerts. Don't paint the UI red; it's the accent that draws the eye to what's urgent.

### Color tokens (design system)

```
/* PRIMARY — Leaf Green (brand, primary actions, positive) */
--green-50:  #F0FDF4;
--green-100: #DCFCE7;
--green-200: #BBF7D0;
--green-300: #86EFAC;
--green-400: #4ADE80;
--green-500: #22C55E;   /* primary */
--green-600: #16A34A;   /* primary hover / brand core */
--green-700: #15803D;
--green-800: #166534;
--green-900: #14532D;

/* SECONDARY — Red (accents, destructive, dues/overdue, errors) */
--red-50:  #FEF2F2;
--red-100: #FEE2E2;
--red-200: #FECACA;
--red-300: #FCA5A5;
--red-400: #F87171;
--red-500: #EF4444;    /* secondary */
--red-600: #DC2626;    /* secondary hover / destructive */
--red-700: #B91C1C;

/* SUPPORT */
--amber-500: #F59E0B;  /* warning / low-stock */
--blue-500:  #3B82F6;  /* info */

/* NEUTRALS */
--bg:      #FFFFFF;
--surface: #F9FAFB;
--border:  #E5E7EB;
--text:    #111827;
--muted:   #6B7280;

/* DARK MODE */
--bg-dark:      #0B0F0D;  /* near-black, faint green tint */
--surface-dark: #121A15;
--border-dark:  #1F2A22;
--text-dark:    #E5E7EB;
```

### Semantic mapping

| Token | Value | Used for |
|---|---|---|
| `primary` | green-600 `#16A34A` | Main buttons, active nav, brand |
| `primary-foreground` | white | Text on primary |
| `secondary` | red-500 `#EF4444` | Secondary/accent actions |
| `destructive` | red-600 `#DC2626` | Delete, cancel invoice |
| `success` | green-500 | Paid, received, in-stock |
| `danger` / `overdue` | red-500/600 | Payables, overdue dues, errors |
| `warning` | amber-500 | Low stock, near-expiry |
| `receivable` | green-600 | Money customers owe you (positive) |
| `payable` | red-500 | Money you owe (attention) |

*(These become CSS variables in `packages/ui` and a Tailwind preset shared by web + mobile.)*

---

## 2. Guiding principles

1. **TypeScript everywhere** (strict). Money/tax/sync logic is too risky for plain JS.
2. **Shared core.** Tax engine, money math, validation, and types in one package used by web *and* mobile.
3. **Money is never a float.** Integer minor-units (paise) or a Decimal library. Hard rule.
4. **Offline-ready schema now, sync later.** Client-gen UUIDs, `updated_at`, soft deletes from day 1.
5. **Compliance is an isolated module.** GST/e-invoice/e-way-bill rules change often; keep them contained.
6. **Ship the billing loop first**, even though the north star is full parity.

---

## 3. Final tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Safety across money/tax/sync |
| Monorepo | **Turborepo + npm workspaces** | Share code web ↔ mobile (npm chosen over pnpm: no admin needed on this machine) |
| Web | **Next.js 15** + Tailwind + shadcn/ui | Fast, modern |
| Mobile | **React Native + Expo** | iOS + Android from one TS codebase |
| Animation | **GSAP** (+ `@gsap/react` `useGSAP`) | High-performance, framework-agnostic UI motion: page/section transitions, number/counter tweens on dashboards, chart reveals, micro-interactions. React-safe cleanup via `useGSAP` |
| Backend data | **Supabase** (Postgres, Auth, Storage, Realtime) | Auth + DB + files built-in |
| ORM/migrations | **Prisma** | Schema + migrations as source of truth |
| Validation | **Zod** (shared) | One schema for API + forms + types |
| Jobs worker | **Node (Hono/Express)** | PDFs, GST filing, e-invoice govt APIs |
| PDF/print | React-PDF/Puppeteer (A4) + ESC/POS (thermal) | Invoice output |
| Data fetching | **TanStack Query** | Caching, retries, offline-friendly later |

> Your Next/Node/Supabase/Prisma picks kept. Standalone Express **dropped** for the main API (Next + Supabase cover it); a small worker handles heavy jobs. **React Native added** — Vyapar's users are on phones.

---

## 4. Monorepo layout — `client/` + `server/` + `shared/`

Top-level split: **`client/`** = everything frontend, **`server/`** = everything backend,
**`shared/`** = code both sides import (tax engine, types, config). npm workspaces + Turborepo tie them together.

```
leafx/
├─ client/                 # ALL FRONTEND
│  ├─ web/                 # Next.js 15 (admin + web billing + online store)
│  ├─ mobile/              # Expo React Native
│  └─ ui/                  # Leafx design tokens + shared components + GSAP motion presets
├─ server/                 # ALL BACKEND
│  ├─ api/                 # API layer (Next route handlers / Node service)
│  ├─ worker/              # Node job runner (PDF, GST, e-invoice, backups)
│  ├─ prisma/              # schema.prisma + migrations
│  └─ db/                  # @leafx/db — Prisma client singleton + db helpers
├─ shared/                 # USED BY BOTH client & server
│  ├─ core/                # tax engine, money math, invoice numbering
│  ├─ types/               # TS types + Zod schemas
│  └─ config/              # tsconfig base + Tailwind preset (green/red theme)
├─ docs/templates/         # invoice print templates (GST Tally, thermal, …)
├─ .env / .env.example     # secrets (gitignored) + committed template
└─ turbo.json
```

> **Why `shared/`?** The GST tax engine and domain types run on the client (live invoice
> math while typing) *and* the server (validation, GSTR export). Duplicating them would be a
> correctness risk, so the most critical code lives in one place both import.

---

## 4b. Environment & Supabase integration ✅ WIRED

Supabase project **Leafx** (`vfhoqngijnjkkbykzwmu`, region `ap-northeast-1`) is connected and the
Phase 0/1 schema is live in Postgres.

**Env vars** (in gitignored `.env`; template in `.env.example`):

| Var | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Runtime queries — **pooler** session mode (port 5432) |
| `DIRECT_URL` | server | Migrations / `db push` — also pooler (see note) |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | both | Project URL |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Public key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Admin key — never exposed to browser |
| `SUPABASE_JWT_SECRET` | **server only** | Token verification |

**Connectivity note:** the true direct host `db.<ref>.supabase.co` is IPv6-only / unreachable on
this network, so **both** `DATABASE_URL` and `DIRECT_URL` use the IPv4 **session-mode pooler**
(`aws-1-ap-northeast-1.pooler.supabase.com:5432`), which supports DDL.

**DB commands** (run from repo root — auto-loads `.env`):
`npm run db:generate` · `npm run db:push` · `npm run db:migrate` · `npm run db:studio`

**Live tables:** `Business`, `User`, `Membership`, `Party`, `Item`, `ItemCategory`.

> 🔐 **Security:** service-role key and JWT secret were shared in plaintext during setup —
> **rotate them in the Supabase dashboard** and update `.env`. RLS policies must be added before
> the anon key touches any real data (Phase 0/1 follow-up).

---

## 5. COMPLETE Vyapar feature inventory (full parity target)

Everything below is in scope. Grouped by module.

### A. Transactions (sales & purchases)
- Sale invoice (GST & non-GST)
- Sale return / **Credit note**
- Purchase bill / Purchase invoice
- Purchase return / **Debit note**
- **Payment-in** (receive) / **Payment-out** (pay)
- **Expense** (with categories, GST expense) & **Other income**
- **Estimate / Quotation** & **Proforma invoice**
- **Sale order** & **Purchase order** (with open/close, convert to invoice)
- **Delivery challan** (+ goods return on challan, print amount toggle)
- **Recurring invoices / transactions**
- **POS billing mode** (fast counter checkout)
- Convert: estimate → invoice, order → invoice, challan → invoice (one tap)

### B. Parties (customers & suppliers)
- Customer & supplier master; **party groups**
- GSTIN, state, billing + shipping address, phone, email
- Opening balance, **credit limit**, **credit period**
- Party ledger / statement; party-wise outstanding
- **Loyalty points** per customer
- Additional/custom fields
- Bulk import (Excel), bulk edit
- **Payment reminders** (WhatsApp/SMS), bulk reminders, greetings/marketing

### C. Items & inventory
- Products & services
- **Categories**, **units** + compound units / unit conversion
- **HSN / SAC** codes
- **Wholesale + retail pricing**, party-wise price
- **Multiple MRP**, **batch no**, **serial no**, **expiry date**, **brand**, color, size
- **Barcode generation** + scanning (camera + USB/BT scanner)
- Stock quantity, **min stock / low-stock alerts**, item images
- Bulk item edit / import
- **Stock adjustment**, item-wise profit
- **Manufacturing items** (raw material → finished goods)
- **Bill of Materials (BOM)** with automatic consumption
- **Godown / warehouse** (multi-location stock) + **stock transfer**
- Discount, tax, cess, free-qty

### D. Money — cash & bank
- Cash in hand
- **Multiple bank accounts**
- **Cheque management** (open/close, deposit, withdraw)
- Bank ↔ cash transfer / adjustment
- **Loan accounts**
- **UPI / QR** payment; online payment collection (gateway)
- Multiple payment modes (cash/cheque/UPI/bank/card)

### E. GST, tax & compliance
- GST invoices; slabs 0/5/12/18/28 + **cess**
- IGST / CGST / SGST / UTGST auto-split (inter vs intra-state)
- **Reverse charge**, tax inclusive/exclusive, **TCS / TDS**
- **Composition scheme**, **VAT** (UAE mode)
- **E-invoice** (IRN + signed QR)
- **E-way bill**
- **GSTR-1, GSTR-2, GSTR-3B, GSTR-4, GSTR-9** auto-generation + JSON export
- HSN-wise summary, GSTIN verification utility

### F. Reports (50+)
Sale, purchase, day book, all-transactions, **Profit & Loss**, **Balance sheet**, **Cash flow**, all GST/GSTR, GST-rate, party statement/ledger, receivable/payable **aging**, stock summary, low-stock, item-wise profit/sale/purchase, expense (category & item), bank statement, discount report, loyalty report, order reports, TCS/TDS reports. **Export to Excel & PDF.**

### G. Print, templates & sharing
- ~15 regular themes (A4/A5) + ~5 **thermal** themes (2"/3" ESC/POS)
- Company logo, digital signature, custom fields, terms & conditions
- Multiple invoice **prefixes / number series**
- Configurable columns/totals
- Send via **WhatsApp / SMS / Email**; UPI/QR on invoice

### H. Business management & settings
- **Multi-firm** (multiple businesses per account)
- **Multi-user + role-based access control** + activity/audit log
- Business **dashboard / analytics**
- Feature toggles (transaction/item/party/tax settings)
- Invoice numbering & **financial year** settings
- **Backup & restore** — local + **auto-backup to Google Drive**
- Data security / passcode lock
- Import from **Tally / Excel**, data export

### I. Growth & extras
- **Online store** (catalog + order dashboard, WhatsApp orders)
- Payment reminders & WhatsApp greetings/marketing
- **Rewards / referral** program
- Barcode/thermal retail POS flows
- Multi-language / multi-currency (where applicable)

---

## 6. Core data model (v1 → grows across phases)

Every table: `id (uuid, client-gen)`, `business_id`, `created_at`, `updated_at`, `deleted_at` (soft delete).

- **businesses** (firms) · **users / memberships** (roles) · **user_activity_log**
- **parties** · **party_groups**
- **items** · **item_categories** · **units** · **godowns** · **stock_ledger** · **batches** · **serials**
- **bom** · **bom_lines** (manufacturing)
- **transactions** (`type` enum covering all A) · **transaction_lines**
- **payments** · **payment_allocations**
- **bank_accounts** · **cheques** · **loan_accounts**
- **tax_rates** · **hsn_codes**
- **invoice_series** · **templates** · **settings**
- **online_store_orders** · **loyalty_ledger**

---

## 7. Phased roadmap (to full parity)

Each phase is shippable. Online-only until Phase 12.

Legend: ✅ done · 🚧 in progress · ⬜ not started.

| Phase | Name | Delivers | Status |
|---|---|---|---|
| **0** | Foundations | Monorepo, Supabase (live schema), Leafx theme/tokens, shared `core`/`types` (tax engine + 13 tests), **strict TS**, **GitHub Actions CI** (typecheck + test). Auth done in phase A. | ✅ |
| **1** | Masters | Parties & Items CRUD (all fields, categories, units, groups, import) | ✅ Parties + Items live + **party groups**. *Bulk import = follow-up* |
| **A** | **Auth & security** | Login, multi-tenant scoping, RLS | ✅ Supabase Auth (email/password), JWT-verified API, per-user business provisioning, **RLS on all 9 tables**. *Phone OTP needs an SMS provider in Supabase; RLS `auth.uid()` policies when the browser talks to Supabase directly* |
| **2** | **Billing loop ⭐** | Sale invoice + tax engine + numbering + A4 PDF + share | ✅ Builder + gap-free numbering + GST-Tally print view (seller GSTIN/PAN + bank details) + **Business Settings** screen; INV-1 matches golden case. *Server-side PDF export = Phase 9* |
| **3** | Money in/out | Payments, allocations, party ledger, dues, payment modes | ✅ Payment in/out (cash/UPI/bank/cheque/card) + **party ledger with running balance** + receivable/payable outstanding; verified (₹1180 − ₹500 = ₹680). *Invoice-level allocation + receivables dashboard = follow-ups* |
| **4** | Purchases & expenses | Purchase bills, expenses, supplier ledger | ✅ Purchase bills (input GST) + expenses + supplier payables; verified |
| **5** | Inventory | Live stock, low-stock alerts, adjustments | ✅ Signed stock movements from sale/purchase, adjustments, low-stock; verified (100→150→120→10). *Batch/serial/expiry = follow-up* |
| **6** | All documents | Estimates, orders, challans, credit/debit notes, conversions | ✅ 7 doc types + estimate→invoice convert (with stock effects); verified. *Recurring = follow-up* |
| **7** | Cash & bank | Bank accounts, transfers | ✅ Accounts + balances + deposit/withdraw/transfer; verified. *Cheque/loan mgmt = follow-up* |
| **8** | Reports engine | P&L, GSTR-1/3B, stock valuation, party aging, day book | ✅ Summary/GST/stock/outstanding/daybook; all figures verified. *Excel export = follow-up* |
| **9** | Print & branding | A4 GST-Tally + thermal ESC/POS | ✅ A4 + **80mm thermal** receipt. *Server-side PDF (puppeteer) = deploy-time* |
| **10** | GST compliance | GSTR-1 JSON, e-invoice payload | ✅ GSTR-1 (B2B/B2C) export + NIC e-invoice JSON; verified. *IRN/e-way submission needs GSP creds* |
| **11** | Manufacturing & godowns | BOM, production, godowns | ✅ BOM + production (raw consumed → finished produced); verified. *Per-godown stock = follow-up* |
| **12** | **Offline-first sync** | Local SQLite + sync | 📄 Design + migration plan in `docs/OFFLINE-SYNC.md` (needs PowerSync infra; schema already sync-ready) |
| **13** | Multi-firm & roles | Multiple businesses, RBAC | ✅ Firm switcher + `x-business-id` scoping + roles; tenant isolation verified |
| **14** | Backup & import | Export/restore, bulk import | ✅ Full JSON backup + import (parties/items) into a firm; verified. *Google-Drive auto-backup = follow-up* |
| **15** | POS & retail | Fast counter POS mode | ✅ Tap-to-cart POS → charge → thermal receipt |
| **16** | Online store & growth | Public catalog, WhatsApp reminders | ✅ Public shareable catalog + WhatsApp order/payment reminders. *Loyalty/rewards = follow-up* |

---

## 8. Highest-risk areas (plan extra time)

1. **Tax engine correctness** — IGST vs CGST+SGST, cess, inclusive/exclusive, round-off, reverse charge, TCS/TDS. Build with a large test suite in `core` *before* invoice UI.
2. **Invoice numbering** — sequential, gap-free, per-series, under multi-device use.
3. **Offline sync (Phase 12)** — conflict resolution is genuinely hard; deferred on purpose.
4. **Govt e-invoice / e-way APIs (Phase 10)** — GSP onboarding, tokens, sandbox → prod, downtime.
5. **Thermal print (Phase 9)** — ESC/POS quirks across printer models.
6. **Manufacturing/BOM stock accuracy (Phase 11)** — nested consumption + costing.

---

## 9. Immediate next steps

1. Scaffold Turborepo (`apps/web`, `apps/mobile`, `packages/core|db|types|ui|config`).
2. Put the **Leafx green/red theme** into `packages/ui` (CSS vars + Tailwind preset) so web + mobile share it. Add **GSAP** (+ `@gsap/react`) here as the shared web motion layer with reusable animation presets.
3. Supabase project + Prisma schema for Phase 0/1 tables.
4. Auth (phone OTP) on web + mobile.
5. Build `core` tax engine **with tests first**.
6. Start Phase 1 (Parties & Items).

---

*Reference only: the installed Vyapar app is used to observe expected behavior. No Vyapar code, assets, or designs are copied. Leafx UI, code, and brand are original.*
