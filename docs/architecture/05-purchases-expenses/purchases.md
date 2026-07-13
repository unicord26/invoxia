# Purchase Bills

## 1. Purpose
Supplier bills mirror sale invoices in reverse: they record goods/services bought from a supplier, claim **input GST**, increase stock, and post to the supplier's payable ledger. Numbered `PUR-n`.

## 2. Ecosystem
```mermaid
flowchart LR
  New["purchases/new"] -->|"POST /api/purchases"| R["purchasesRouter"]
  R --> Tax["computeInvoice (state flipped: buyer↔seller)"]
  R --> Num["nextNumber('purchase') → PUR-n"]
  R --> Stock["recordStock (+ qty)"]
  R --> DB[("Transaction type=purchase")]
  DB --> Ledger["supplier payable"]
  DB --> GST["input tax (reports/GSTR)"]
```

## 3. Architecture
```mermaid
graph TD
  A["purchases/new/page.tsx"] -->|"createPurchaseSchema"| B["routes/purchases.ts"]
  B --> C["computeInvoice (input GST; place-of-supply from supplier)"]
  B --> D["recordStock(+ qty)"]
  B --> E["Prisma Transaction(type=purchase)"]
  E --> F[("Postgres")]
```

## 4. Data model
Reuses `Transaction`(`type=purchase`) + `TransactionLine`. `referenceNo` holds the supplier's bill number. Tax split stored same as sales but counts as **input** credit.

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as purchase builder
  participant R as purchasesRouter
  participant P as Prisma
  W->>R: POST /api/purchases {supplier, lines, supplierBillNo}
  R->>R: computeInvoice + nextNumber('purchase')
  R->>P: Transaction + lines
  R->>P: StockMovement(+qty) per line
  R-->>W: created bill (payable ↑)
```

## 6. API surface
- `GET /api/purchases` · `GET /api/purchases/:id` · `POST /api/purchases`

## 7. Key files
- `client/web/app/purchases/page.tsx`, `app/purchases/new/page.tsx`
- `server/api/src/routes/purchases.ts` · `shared/types` → `createPurchaseSchema`

## 8. Status vs Vyapar
✅ Purchase bill, input GST, stock-in, supplier ledger, numbering · 🟦 shadcn builder, transaction extras where relevant (Milestone 1) · ⬜ purchase-order → bill auto-fill, landed cost.
