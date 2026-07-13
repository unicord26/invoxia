# Sale Invoices

## 1. Purpose
The core billing document. A sale invoice captures party + line items, computes GST-correct totals via the shared tax engine, gets a gap-free number, reduces stock, and posts to the party ledger. Renders to an A4 (Tally-style) and thermal print view.

## 2. Ecosystem
```mermaid
flowchart LR
  New["invoices/new (builder)"] -->|"POST /api/invoices"| R["invoicesRouter"]
  R --> Tax["computeInvoice (@leafx/core)"]
  R --> Num["nextNumber (lib/numbering.ts)"]
  R --> Stock["recordStock (− qty)"]
  R --> DB[("Transaction + TransactionLine")]
  List["invoices list"] --> R
  Detail["invoices/[id] (A4 + thermal)"] --> R
  Ledger["party ledger / reports"] --> DB
```

## 3. Architecture
```mermaid
graph TD
  A["invoices/new/page.tsx"] -->|"createInvoiceSchema"| B["routes/invoices.ts"]
  B --> C["computeInvoice: per-line CGST/SGST/IGST, cess, discount, round-off"]
  B --> D["nextNumber('sale') → INV-n"]
  B --> E["recordStock(− line qty)"]
  B --> F["Prisma: Transaction + lines (paise)"]
  F --> G[("Postgres")]
  H["invoices/[id]/page.tsx"] -->|"GET /:id"| B
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ Transaction : owns
  Party ||--o{ Transaction : billed
  Transaction ||--o{ TransactionLine : has
  Transaction {
    enum type "sale"
    string number "INV-n"
    bool interState
    int subTotal
    int cgst
    int sgst
    int igst
    int roundOff
    int grandTotal
    string ewayBillNo "🟦"
    json additionalCharges "🟦"
    int discountFlat "🟦"
    bool reverseCharge "🟦"
    string termsConditions "🟦"
  }
  TransactionLine {
    float qty
    int rate
    float discountPercent
    float taxRate
    int taxable
    int lineTotal
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as builder
  participant R as invoicesRouter
  participant C as "@leafx/core"
  participant P as Prisma
  W->>R: POST /api/invoices {party, lines, extras 🟦}
  R->>C: computeInvoice(lines, seller/buyer state)
  C-->>R: totals (intra→CGST+SGST, inter→IGST) + round-off
  R->>R: nextNumber('sale') → INV-n
  R->>P: Transaction + lines
  R->>P: StockMovement(−qty) per line
  R-->>W: created invoice
```

## 6. API surface
- `GET /api/invoices` · `GET /api/invoices/:id` · `POST /api/invoices`

## 7. Key files
- `client/web/app/invoices/new/page.tsx`, `app/invoices/page.tsx`, `app/invoices/[id]/page.tsx` (+ `/thermal`)
- `server/api/src/routes/invoices.ts`
- `shared/core/src/tax.ts` (`computeInvoice`) · `shared/types` (`createInvoiceSchema`) · `lib/numbering.ts`

## 8. Status vs Vyapar
✅ GST-correct sale invoice, gap-free numbering, stock + ledger impact, A4 + thermal print · 🟦 shadcn builder, "More options" (e-way/transport/charges/TCS-TDS/reverse-charge/T&C), flat discount, logo/signature on print, theme selection (Milestone 1) · ⬜ e-invoice IRP submission, e-way portal.
