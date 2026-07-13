# Stock & Godowns

## 1. Purpose
Stock is tracked as an append-only ledger of signed `StockMovement` rows; current stock = `item.openingStock + Σ qty`. Godowns (warehouses/stores) are a master list today but stock is **not yet godown-aware** — Milestone 1 adds `godownId` on movements plus godown-to-godown transfers.

## 2. Ecosystem
```mermaid
flowchart LR
  Inv["Sale invoice"] -->|"− qty"| SM[("StockMovement")]
  Pur["Purchase bill"] -->|"+ qty"| SM
  Adj["Manual adjust"] -->|"± qty"| SM
  Prod["Production (BOM)"] -->|"− raw / + finished"| SM
  SM --> Map["getStockMap()"]
  Map --> Items["Items list currentStock"]
  Map --> Rep["Reports: stock valuation, low stock"]
  Xfer["Stock transfer 🟦"] -->|"paired ± with godownId"| SM
```

## 3. Architecture
```mermaid
graph TD
  A["any stock-affecting route"] --> B["recordStock (lib/stock.ts)"]
  B --> C[("StockMovement { qty, reason, godownId 🟦 })"]
  D["read paths"] --> E["getStockMap(businessId)"]
  E --> C
  E --> F["current qty per item (per godown 🟦)"]
```

## 4. Data model
```mermaid
erDiagram
  Item ||--o{ StockMovement : moves
  Business ||--o{ Godown : owns
  Godown ||--o{ StockTransfer : "from/to 🟦"
  StockMovement {
    float qty "+ in / − out"
    string reason "sale|purchase|adjustment|production"
    string refTransactionId
    string godownId "🟦"
  }
  StockTransfer {
    string itemId "🟦"
    string fromGodownId "🟦"
    string toGodownId "🟦"
    float qty "🟦"
  }
```

## 5. Key flows
Godown transfer (planned) writes paired movements:
```mermaid
sequenceDiagram
  participant W as transfer UI
  participant R as godownsRouter
  participant P as Prisma
  W->>R: POST /api/godowns/transfer {itemId, fromId, toId, qty}
  R->>P: StockMovement(−qty, godownId=from)
  R->>P: StockMovement(+qty, godownId=to)
  R->>P: StockTransfer record
  R-->>W: ok (net stock unchanged, location moved)
```

## 6. API surface
- `GET /api/godowns` · `POST /api/godowns` (name only, today)
- `POST /api/godowns/transfer` 🟦 · stock read via `getStockMap` inside items/reports

## 7. Key files
- `server/api/src/lib/stock.ts` — `recordStock`, `getStockMap`
- `server/api/src/routes/manufacturing.ts` — godowns live here (mounted at `/api`)
- `server/prisma/schema.prisma` — `StockMovement`, `Godown`, (🟦 `StockTransfer`)

## 8. Status vs Vyapar
✅ Signed-movement stock ledger, valuation, low-stock flags · 🟡 Godown master exists but inert · 🟦 godown-aware stock + transfers (Milestone 1) · ⬜ per-godown min levels, stock audit report.
