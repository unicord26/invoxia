# Multi-Firm Tenancy

## 1. Purpose
A single user can own/belong to multiple businesses ("firms"). Every piece of business data is scoped to one `Business`; the **active firm** is chosen by the client and passed as an `x-business-id` header, resolved and authorized server-side.

## 2. Ecosystem
```mermaid
flowchart LR
  FS["FirmSwitcher (sidebar)"] -->|"localStorage leafx.businessId"| API["lib/api.ts"]
  API -->|"x-business-id header"| RT["authed routes"]
  RT --> GUB["getUserBusinessId()"]
  GUB -->|"verify membership"| DB[("Membership")]
  GUB -->|"scope"| Data["Party / Item / Transaction / ..."]
```

## 3. Architecture
```mermaid
graph TD
  A["Request + Bearer + x-business-id"] --> B["requireAuth → authUser"]
  B --> C["getUserBusinessId(authUser)"]
  C -->|"header present?"| D{"member of<br/>requested firm?"}
  D -->|yes| E["use requested businessId"]
  D -->|no / absent| F["default: first membership<br/>(provision on first login)"]
  E & F --> G["all queries: where businessId = active"]
```

## 4. Data model
```mermaid
erDiagram
  User ||--o{ Membership : has
  Business ||--o{ Membership : has
  Membership { enum role "owner|admin|staff" }
  Membership { string userId }
  Membership { string businessId }
```
`Membership @@unique([userId, businessId])`. `Role` enum exists but **no route enforces role-based permissions** yet (all members act as owner).

## 5. Key flows
Switch firm (planned improvement — no hard reload):
```mermaid
sequenceDiagram
  participant U as User
  participant FS as FirmSwitcher
  participant LS as localStorage
  participant Q as QueryClient
  U->>FS: select firm
  FS->>LS: set leafx.businessId
  FS->>Q: invalidateQueries() + router.refresh()
  Note over Q: all data refetched with new x-business-id
```

## 6. API surface
- `GET /api/businesses` — firms the user belongs to (provisions first firm)
- `POST /api/businesses` — create a firm (caller becomes owner)
- `GET/PATCH /api/business/current` — active firm profile

## 7. Key files
- `server/api/src/lib/business.ts` — `getUserBusinessId`, `getUserRole`
- `server/api/src/routes/businesses.ts`, `routes/business.ts`
- `client/web/app/firm-switcher.tsx` · `client/web/lib/api.ts` (`x-business-id`)

## 8. Status vs Vyapar
✅ Multi-firm create/switch, tenant isolation verified · 🟡 Role enum unenforced · 🟦 FirmSwitcher → shadcn dropdown, switch without full reload (Milestone 1) · ⬜ accountant/staff permission matrix (M2+).
