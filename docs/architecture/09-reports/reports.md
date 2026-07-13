# Reports

## 1. Purpose
Aggregated business insight computed on demand from transactions, stock and ledger: a dashboard KPI feed plus P&L summary, party outstanding, stock valuation, GST (GSTR-3B style), and daybook.

## 2. Ecosystem
```mermaid
flowchart LR
  Dash["dashboard KPIs"] -->|"/api/reports/dashboard"| R["reportsRouter"]
  Rep["reports/page.tsx"] -->|"summary/outstanding/stock/gst"| R
  R --> Tx[("Transaction")]
  R --> SM[("StockMovement")]
  R --> Led["signedBalanceDelta"]
```

## 3. Architecture
```mermaid
graph TD
  A["reports endpoints"] --> B["Prisma groupBy / aggregate"]
  B --> C["summary: sales/purchases/expenses, output/input tax, gross profit"]
  B --> D["outstanding: party balances (receivable/payable)"]
  B --> E["stock: qty × purchasePrice, low-stock"]
  B --> F["gst: CGST/SGST/IGST output vs input, net payable"]
  B --> G["dashboard: today sales, counts, cash+bank"]
```

## 4. Data model
No tables of its own; reads `Transaction`, `TransactionLine`, `StockMovement`, `Party`, `BankAccount/Entry`.

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as dashboard
  participant R as reportsRouter
  participant P as Prisma
  W->>R: GET /api/reports/dashboard
  R->>P: today sales Σ, party count, product count, low-stock, bank Σ
  R-->>W: KPI JSON → Card tiles
```

## 6. API surface
- `GET /api/reports/dashboard` · `/summary` · `/outstanding` · `/stock` · `/gst` · `/daybook`

## 7. Key files
- `client/web/app/reports/page.tsx` · `client/web/components/DashboardMetrics.tsx`
- `server/api/src/routes/reports.ts` · `lib/ledger.ts`, `lib/stock.ts`

## 8. Status vs Vyapar
✅ Dashboard KPIs (live), P&L summary, outstanding, stock valuation, GSTR-3B summary, daybook · ⬜ ageing buckets, item-wise profit, bill-wise settlement, cash-flow, day-book filters/exports (M2+).
