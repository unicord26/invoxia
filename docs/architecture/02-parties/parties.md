# Parties (Customers & Suppliers)

## 1. Purpose
Parties are the customers and suppliers a firm transacts with. Each party carries contact/GST details, an opening balance, optional credit terms, and a **running ledger** derived from its transactions (receivable when positive, payable when negative).

## 2. Ecosystem
```mermaid
flowchart LR
  P["Parties screen"] -->|"/api/parties"| R["partiesRouter"]
  R --> DB[("Party")]
  Inv["Invoices / Purchases / Payments"] -->|"partyId"| DB
  R -->|"ledger = opening + Σ signed txns"| L["lib/ledger.ts"]
  Rep["Reports (outstanding)"] --> L
```

## 3. Architecture
```mermaid
graph TD
  A["parties/page.tsx (list + add)"] -->|api.get/post| B["routes/parties.ts"]
  A2["parties/[id]/page.tsx (ledger)"] -->|"/api/parties/:id/ledger"| B
  B --> C["signedBalanceDelta (lib/ledger.ts)"]
  B --> D["Prisma Party + Transaction groupBy"]
  D --> E[("Postgres")]
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ Party : owns
  Party ||--o{ Transaction : party_of
  Party {
    string id PK
    enum type "customer|supplier|both"
    string groupName
    string gstin
    string billingAddress
    string shippingAddress
    int openingBalance "paise, signed"
    int creditLimit
    int creditPeriodDays
    string status "🟦 active|inactive"
    int loyaltyPoints "🟦"
  }
```

## 5. Key flows
Party ledger:
```mermaid
sequenceDiagram
  participant W as party detail
  participant R as partiesRouter
  participant P as Prisma
  W->>R: GET /api/parties/:id/ledger
  R->>P: party + all its transactions
  R->>R: balance = opening + Σ signedBalanceDelta(type, grandTotal)
  Note over R: sale/debit_note +, payment_in/credit_note −,<br/>purchase −, payment_out +
  R-->>W: entries[] + outstanding
```

## 6. API surface
- `GET /api/parties` · `POST /api/parties` · `PATCH /api/parties/:id` · `DELETE /api/parties/:id` (soft)
- `GET /api/parties/:id/ledger`

## 7. Key files
- `client/web/app/parties/page.tsx`, `app/parties/[id]/page.tsx`
- `server/api/src/routes/parties.ts` · `server/api/src/lib/ledger.ts`
- `shared/types/src/index.ts` → `partySchema`

## 8. Status vs Vyapar
✅ CRUD, ledger, opening balance, credit limit/period, billing+shipping address, free-text group · 🟦 shadcn table + Add-Party dialog, `status`/`loyaltyPoints` fields (Milestone 1) · ⬜ true Party Groups entity, custom fields, WhatsApp connect, payment-reminder automation.
