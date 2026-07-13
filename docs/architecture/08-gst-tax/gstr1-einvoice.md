# GSTR-1 & E-Invoice

## 1. Purpose
GST compliance outputs. **GSTR-1** produces the monthly outward-supplies JSON (B2B grouped by counter-party GSTIN, B2C summarised). **E-Invoice** builds the NIC IRP JSON payload for a given invoice (payload only — not yet submitted to the portal).

## 2. Ecosystem
```mermaid
flowchart LR
  GstUI["gst/page.tsx"] -->|"/api/gst/gstr1?month&year"| R["gstRouter"]
  R --> Tx[("Transaction sale")]
  R --> B2B["group by party GSTIN"]
  R --> B2C["summary (no/unregistered GSTIN)"]
  GstUI -->|"/api/gst/einvoice/:id"| EI["NIC e-invoice JSON payload"]
```

## 3. Architecture
```mermaid
graph TD
  A["gst/page.tsx (month/year)"] --> B["routes/gst.ts"]
  B --> C["fetch sales in period"]
  C --> D{"party GSTIN?"}
  D -->|yes| E["B2B bucket by GSTIN + rate"]
  D -->|no| F["B2C aggregate"]
  B --> G["einvoice/:id → build IRP schema (seller/buyer/items/tax)"]
```

## 4. Data model
Reads `Transaction`(`type=sale`) + lines + party GSTIN + business GSTIN. No new tables. `reverseCharge` currently hardcoded `"N"` in output → 🟦 read the real `Transaction.reverseCharge` field (Task 11).

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as gst page
  participant R as gstRouter
  participant P as Prisma
  W->>R: GET /api/gst/gstr1?month=..&year=..
  R->>P: sales in period + lines + party gstin
  R->>R: split B2B (by GSTIN) / B2C (summary)
  R-->>W: GSTR-1 JSON
  W->>R: GET /api/gst/einvoice/:id
  R-->>W: NIC IRP payload (unsubmitted)
```

## 6. API surface
- `GET /api/gst/gstr1?month=&year=` · `GET /api/gst/einvoice/:id`

## 7. Key files
- `client/web/app/gst/page.tsx`
- `server/api/src/routes/gst.ts`

## 8. Status vs Vyapar
✅ GSTR-1 B2B/B2C JSON, e-invoice payload · 🟦 real reverse-charge flag from data (Task 11) · ⬜ GSTR-3B export file, actual IRP/e-way portal submission, GSTR-2A/2B reconciliation.
