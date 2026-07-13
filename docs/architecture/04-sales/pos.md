# POS (Counter Billing)

## 1. Purpose
A fast, tap-driven counter-billing screen: an item grid, a running cart, quick party selection, and one-tap checkout that posts a normal sale invoice through the same pipeline (totals, numbering, stock, ledger).

## 2. Ecosystem
```mermaid
flowchart LR
  POS["pos/page.tsx"] -->|"GET /api/items"| Items["itemsRouter"]
  POS -->|"GET /api/parties"| Parties["partiesRouter"]
  POS -->|"POST /api/invoices"| Inv["invoicesRouter (shared pipeline)"]
  Inv --> Stock & Ledger & Number
```

## 3. Architecture
```mermaid
graph TD
  A["POS grid + cart"] --> B["build line items"]
  B --> C["POST /api/invoices"]
  C --> D["same as Sale Invoice pipeline"]
  D --> E[("Transaction")]
```

## 4. Data model
Reuses `Transaction` (`type = sale`) + `TransactionLine`. No POS-specific tables. Payment can be marked via `paymentMode`.

## 5. Key flows
```mermaid
sequenceDiagram
  participant C as Cashier
  participant P as POS
  participant I as invoicesRouter
  C->>P: tap items → cart
  C->>P: select party (or walk-in)
  C->>P: checkout
  P->>I: POST /api/invoices
  I-->>P: invoice # + print
```

## 6. API surface
No new endpoints — consumes `/api/items`, `/api/parties`, `/api/invoices`.

## 7. Key files
- `client/web/app/pos/page.tsx`
- (shared) `server/api/src/routes/invoices.ts`

## 8. Status vs Vyapar
✅ Item grid, cart, party select, invoice checkout · 🟦 shadcn polish, barcode input, quick-tender (Milestone 1 optional) · ⬜ offline mode, cash-drawer/receipt-printer integration, held bills.
