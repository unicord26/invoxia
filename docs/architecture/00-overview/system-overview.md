# System Overview

## 1. Purpose
Leafx is a multi-tenant GST billing, inventory and accounting platform for Indian SMEs. It is a Turborepo/npm-workspaces monorepo with a Next.js frontend, an Express REST API, a Prisma/Postgres data layer on Supabase, and shared pure-logic packages (money + GST tax engine, Zod types, design tokens).

## 2. Ecosystem
```mermaid
flowchart LR
  subgraph Client["client/ (frontend)"]
    Web["@leafx/web<br/>Next.js 15 App Router"]
    UI["@leafx/ui<br/>design tokens"]
  end
  subgraph Shared["shared/ (pure logic)"]
    Core["@leafx/core<br/>money + GST engine"]
    Types["@leafx/types<br/>Zod schemas"]
    Config["@leafx/config<br/>tsconfig + tailwind preset"]
  end
  subgraph Server["server/ (backend)"]
    API["@leafx/api<br/>Express REST"]
    DB["@leafx/db<br/>Prisma client"]
  end
  subgraph Supabase["Supabase (cloud)"]
    Auth["Auth (JWT)"]
    PG[("Postgres")]
    Storage["Storage (business-assets:<br/>item images, logo/signature)"]
  end

  Web -->|"fetch + Bearer JWT<br/>+ x-business-id"| API
  Web -->|"getSession / signIn"| Auth
  Web -.uses.-> Core & Types & UI
  API -->|"validate token"| Auth
  API -->|"queries"| DB --> PG
  API -.uses.-> Core & Types
  Web -->|"logo/signature/item images"| Storage
```

## 3. Architecture (request path)
```mermaid
graph TD
  A["Page (use client)"] -->|"useQuery / useMutation"| B["lib/api.ts<br/>fetch wrapper"]
  B -->|"Authorization: Bearer &lt;supabase JWT&gt;<br/>x-business-id: &lt;firm&gt;"| C["Express app<br/>server/api/src/index.ts"]
  C --> D["requireAuth middleware<br/>lib/auth.ts → supabaseAnon.getUser"]
  D --> E["route handler<br/>routes/*.ts"]
  E --> F["getUserBusinessId()<br/>tenant scoping"]
  E --> G["service libs<br/>tax(core) · stock · ledger · numbering"]
  E --> H["Prisma (@leafx/db)"]
  H --> I[("Supabase Postgres")]
```

## 4. Data model
See the consolidated ERD in [data-model-erd.md](data-model-erd.md). Core entities: `User`↔`Membership`↔`Business` (multi-tenant), and per-business `Party`, `Item`, `Transaction`(+`TransactionLine`), `StockMovement`, `BankAccount`(+`BankEntry`), `NumberSeries`, `Bom`/`Godown`.

## 5. Key flows
Cross-cutting request lifecycle:
```mermaid
sequenceDiagram
  participant U as User (browser)
  participant W as Next.js page
  participant S as Supabase Auth
  participant A as Express API
  participant P as Prisma/Postgres
  U->>W: interact
  W->>S: getSession() → access_token
  W->>A: GET/POST /api/... (Bearer + x-business-id)
  A->>S: auth.getUser(token)
  S-->>A: user
  A->>A: getUserBusinessId(user, x-business-id)
  A->>P: scoped query (where businessId=…)
  P-->>A: rows
  A-->>W: JSON
  W-->>U: render (TanStack Query cache)
```

## 6. API surface
Base URL `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`), all under `/api`. Public: `/health`, `/auth/*`, `/store/*`. Authed (require Supabase JWT): `/business`, `/businesses`, `/parties`, `/items`, `/invoices`, `/payments`, `/purchases`, `/expenses`, `/documents`, `/bank`, `/cheques`, `/loans`, `/reports`, `/gst`, `/bom`, `/production`, `/godowns`, `/backup`.

## 7. Key files
- `server/api/src/index.ts` — app + route mounting
- `server/api/src/lib/auth.ts` — `requireAuth`
- `server/api/src/lib/business.ts` — `getUserBusinessId`
- `client/web/lib/api.ts` — fetch client (token + `x-business-id`)
- `client/web/app/providers.tsx` — auth gate + app shell
- `shared/core/src` — money + tax engine · `shared/types/src/index.ts` — Zod

## 8. Status vs Vyapar
✅ Multi-tenant core, all primary billing modules, settings layer, branding, cheques & loans, godown stock, batch/serial tracking, shadcn/ui design system, CSV import wizard · 🟠 Phase 12: Offline-first sync (PowerSync + SQLite — data model already sync-ready) · ⬜ Growth/marketing suite, Tally import/export, WhatsApp automation (M2+).
