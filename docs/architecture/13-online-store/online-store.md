# Online Store

## 1. Purpose
A public, no-auth storefront per business that exposes the item catalog so customers can browse and place an order via WhatsApp. Served under `/store/[businessId]` and backed by a public API route.

## 2. Ecosystem
```mermaid
flowchart LR
  Cust["Customer (no login)"] --> Store["/store/[businessId] page"]
  Store -->|"GET /api/store/:id/catalog"| R["storeRouter (public)"]
  R --> DB[("Item + Business")]
  Store -->|"order"| WA["wa.me deep link"]
```

## 3. Architecture
```mermaid
graph TD
  A["store/[businessId]/page.tsx (public, raw fetch)"] --> B["/api/store/:businessId/catalog"]
  B --> C["Prisma: business + sellable items"]
  A --> D["cart (client state)"]
  D --> E["compose WhatsApp order → wa.me/<phone>"]
```

## 4. Data model
Read-only projection of `Business` (name/phone) + `Item` (name, price, image 🟦). No orders table — checkout hands off to WhatsApp.

## 5. Key flows
```mermaid
sequenceDiagram
  participant C as Customer
  participant S as store page
  participant R as storeRouter
  C->>S: open /store/:businessId
  S->>R: GET /api/store/:id/catalog
  R-->>S: business + items
  C->>S: add to cart → Order
  S-->>C: opens wa.me with prefilled order text
```

## 6. API surface
- `GET /api/store/:businessId/catalog` (public)

## 7. Key files
- `client/web/app/store/[businessId]/page.tsx` (public route, no shell)
- `server/api/src/routes/store.ts`

## 8. Status vs Vyapar
✅ Public catalog + WhatsApp order handoff · 🟦 item images surface once added (Task 8) · ⬜ real cart/checkout, order capture into transactions, payment links, storefront theming (M2+).
