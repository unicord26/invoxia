# Items (Products & Services)

## 1. Purpose
Items are the products and services a firm sells/buys. Each item holds pricing (sale/purchase/MRP, planned wholesale), tax config (rate, cess, inclusive flag), identifiers (HSN/SAC, barcode, planned item-code), a category, and inventory params (opening/min stock). Live stock is derived from signed `StockMovement` rows.

## 2. Ecosystem
```mermaid
flowchart LR
  I["Items screen / Add-Item modal"] -->|"/api/items"| R["itemsRouter"]
  R --> DB[("Item")]
  R -->|"currentStock = opening + Σ movements"| SM[("StockMovement")]
  Inv["Invoice / Purchase lines"] -->|itemId + stock impact| SM
  Cat["ItemCategory"] --> DB
  Img["ImageUpload → Supabase Storage 🟦"] -.imageUrl.-> DB
```

## 3. Architecture
```mermaid
graph TD
  A["items/page.tsx + Add-Item Dialog"] -->|api| B["routes/items.ts"]
  B --> C["getStockMap (lib/stock.ts)"]
  B --> D["Prisma Item + StockMovement"]
  D --> E[("Postgres")]
  A -.->|"HSN combobox, Pricing/Stock tabs"| A
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ Item : owns
  ItemCategory ||--o{ Item : classifies
  Item ||--o{ StockMovement : moves
  Item {
    string name
    enum type "product|service"
    string hsnSac
    string unit "default PCS"
    int salePrice "paise"
    int purchasePrice
    int mrp
    float taxRate
    float cessRate
    bool taxInclusive
    string barcode
    float openingStock
    float minStock
    string itemCode "🟦 SKU"
    int wholesalePrice "🟦"
    string imageUrl "🟦"
    bool taxOnMrp "🟦"
    bool trackBatch "🟦"
    bool trackSerial "🟦"
  }
```

## 5. Key flows
Create item + stock adjust:
```mermaid
sequenceDiagram
  participant W as Add-Item modal
  participant R as itemsRouter
  participant P as Prisma
  W->>R: POST /api/items (itemSchema)
  R->>P: create Item (opening stock)
  W->>R: POST /api/items/:id/adjust {qty, reason}
  R->>P: create StockMovement (signed)
  R-->>W: item with currentStock
```

## 6. API surface
- `GET /api/items` (with `currentStock`) · `POST /api/items` · `PATCH /api/items/:id` · `DELETE /api/items/:id`
- `POST /api/items/:id/adjust` — signed stock movement

## 7. Key files
- `client/web/app/items/page.tsx`
- `server/api/src/routes/items.ts` · `server/api/src/lib/stock.ts`
- `shared/types/src/index.ts` → `itemSchema`

## 8. Status vs Vyapar
✅ Product/Service, HSN, category, unit, sale/purchase/MRP, tax rate + cess + inclusive, barcode, opening/min stock · 🟦 Vyapar-style Add-Item modal (Pricing/Stock tabs), wholesale price, item code, item image (Milestone 1) · 🟦/⬜ batch & serial → [batch-serial-tracking](batch-serial-tracking.md); godown stock → [stock-and-godowns](stock-and-godowns.md). ⬜ party-wise rate, custom fields.
