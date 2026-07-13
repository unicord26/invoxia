# Numbering Series

## 1. Purpose
Gap-free, per-firm, per-document-type sequential numbering (INV-1, INV-2, PUR-1, …). Guarantees uniqueness via an atomic counter and a DB uniqueness constraint on each transaction's `(businessId, series, seq)`.

## 2. Ecosystem
```mermaid
flowchart LR
  Inv["invoices/purchases/payments/documents"] -->|"nextNumber(key)"| N["lib/numbering.ts"]
  N --> NS[("NumberSeries { key, prefix, next }")]
  N --> Tx["Transaction { series, seq, number }"]
  Settings["settings.prefixes 🟦"] -.->|"customize prefix"| NS
```

## 3. Architecture
```mermaid
graph TD
  A["route needs a number"] --> B["nextNumber(businessId, key)"]
  B --> C["atomic upsert NumberSeries: next++ returning"]
  C --> D["number = prefix + seq"]
  D --> E["Transaction.series/seq/number"]
  E --> F["@@unique([businessId, series, seq]) enforces no dupes"]
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ NumberSeries : owns
  NumberSeries {
    string key "sale|purchase|payment_in|..."
    string prefix "INV|PUR|... (🟦 user-editable)"
    int next
  }
```
Prefixes are currently code-hardcoded per doc type; Milestone 1 lets settings map `NumberSeries.prefix`.

## 5. Key flows
```mermaid
sequenceDiagram
  participant R as any router
  participant N as nextNumber
  participant P as Prisma
  R->>N: nextNumber(businessId, 'sale')
  N->>P: upsert NumberSeries {next: increment}
  P-->>N: seq
  N-->>R: "INV-<seq>"
```

## 6. API surface
Library, not HTTP. Prefix customization arrives via settings (`PATCH /business/current/settings`).

## 7. Key files
- `server/api/src/lib/numbering.ts`
- `server/prisma/schema.prisma` — `NumberSeries`, `Transaction` unique constraint

## 8. Status vs Vyapar
✅ Gap-free per-series numbering, uniqueness enforced · 🟦 user-editable prefixes via settings (Task 12) · ⬜ financial-year reset, custom formats/padding, per-firm invoice-no rules.
