# Estimates, Orders & Delivery Challans

## 1. Purpose
Non-accounting sales documents that precede an invoice: **Estimate/Quotation**, **Proforma Invoice**, **Sale Order**, **Purchase Order**, **Delivery Challan**. They share the `Transaction` model with per-type numbering and can be **converted** into a sale invoice (carrying `convertedToId`).

## 2. Ecosystem
```mermaid
flowchart LR
  Doc["documents screen (tabs)"] -->|"/api/documents?type="| R["documentsRouter"]
  R --> DB[("Transaction (estimate|proforma|sale_order|purchase_order|delivery_challan)")]
  Conv["Convert → Invoice"] -->|"/api/documents/:id/convert"| R
  R -->|"creates"| Inv[("Transaction type=sale")]
  R -->|"sets convertedToId"| DB
```

## 3. Architecture
```mermaid
graph TD
  A["documents/page.tsx (tabs per type)"] -->|"createDocumentSchema"| B["routes/documents.ts"]
  B --> C["per-type prefix + stock direction"]
  B --> D[("Transaction")]
  E["convert"] --> F["clone lines → new sale invoice; link convertedToId"]
```

## 4. Data model
```mermaid
erDiagram
  Transaction {
    enum type "estimate|proforma|sale_order|purchase_order|delivery_challan"
    string convertedToId "→ sale invoice once converted"
    enum status "draft|final|cancelled"
  }
```
Delivery challans may affect stock (goods movement) without accounting impact; estimates/orders do not touch stock or ledger until converted.

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as documents
  participant R as documentsRouter
  participant P as Prisma
  W->>R: POST /api/documents {type, lines}
  R->>P: Transaction(type)
  W->>R: POST /api/documents/:id/convert
  R->>P: new Transaction(type=sale) from lines
  R->>P: source.convertedToId = invoice.id
  R-->>W: invoice
```

## 6. API surface
- `GET /api/documents?type=` · `POST /api/documents` · `POST /api/documents/:id/convert`

## 7. Key files
- `client/web/app/documents/page.tsx`
- `server/api/src/routes/documents.ts` · `shared/types` → `createDocumentSchema`, `documentTypeSchema`

## 8. Status vs Vyapar
✅ All five doc types, per-type numbering, convert-to-invoice · 🟦 enabled-doc-types driven by settings toggles (Milestone 1) · ⬜ order fulfilment tracking, partial conversion.
