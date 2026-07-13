# Manufacturing (BOM & Production)

## 1. Purpose
Light manufacturing: define a **Bill of Materials** (raw items + quantities) for a finished good, then run **production** to consume raw materials and add finished stock — all via signed stock movements.

## 2. Ecosystem
```mermaid
flowchart LR
  UI["manufacturing/page.tsx"] -->|"/api/bom/:itemId"| R["manufacturingRouter"]
  R --> Bom[("Bom + BomLine")]
  Prod["production run"] -->|"/api/production"| R
  R --> SMout["StockMovement − raw"]
  R --> SMin["StockMovement + finished"]
```

## 3. Architecture
```mermaid
graph TD
  A["BOM editor"] -->|"PUT /api/bom/:itemId"| B["routes/manufacturing.ts"]
  B --> C[("Bom + BomLine (replace)")]
  D["produce N units"] -->|"POST /api/production"| B
  B --> E["for each BomLine: recordStock(− qty·N)"]
  B --> F["recordStock(+ N finished)"]
```

## 4. Data model
```mermaid
erDiagram
  Item ||--o{ Bom : "finished good"
  Bom ||--o{ BomLine : "raw materials"
  Bom { string itemId "unique per business" }
  BomLine {
    string rawItemId
    float qty "per 1 finished unit"
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as production
  participant R as manufacturingRouter
  participant P as Prisma
  W->>R: POST /api/production {itemId, qty:N}
  loop each BomLine
    R->>P: StockMovement(− rawQty·N, reason=production)
  end
  R->>P: StockMovement(+ N, finished)
  R-->>W: stock updated
```

## 6. API surface
- `GET /api/bom/:itemId` · `PUT /api/bom/:itemId` (replace lines) · `POST /api/production`
- `GET /api/godowns` · `POST /api/godowns`

## 7. Key files
- `client/web/app/manufacturing/page.tsx`
- `server/api/src/routes/manufacturing.ts` (mounted at `/api`) · `lib/stock.ts`

## 8. Status vs Vyapar
✅ BOM per finished good, production consumes raw + adds finished · ⬜ labour/overhead costing, multi-level BOM, work orders, per-godown production (ties to [stock-and-godowns](../03-items-inventory/stock-and-godowns.md)).
