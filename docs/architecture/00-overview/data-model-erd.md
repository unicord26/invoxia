# Data Model — ERD

## 1. Purpose
The consolidated entity-relationship map of the Prisma schema (`server/prisma/schema.prisma`). Shows current tables plus Milestone-1 additions (marked 🟦). Money fields are integer **paise**; every business table has `id` (uuid), timestamps and `deletedAt` soft-delete.

## 2. Ecosystem
All business data hangs off `Business`; access is granted through `Membership`. Tenant scoping (`where businessId = active firm`) is enforced in every authed route.

## 3. Architecture — current ERD
```mermaid
erDiagram
  User ||--o{ Membership : has
  Business ||--o{ Membership : has
  Business ||--o{ Party : owns
  Business ||--o{ Item : owns
  Business ||--o{ ItemCategory : owns
  Business ||--o{ Transaction : owns
  Business ||--o{ NumberSeries : owns
  Business ||--o{ BankAccount : owns
  Business ||--o{ Godown : owns
  ItemCategory ||--o{ Item : classifies
  Item ||--o{ StockMovement : moves
  Party ||--o{ Transaction : party_of
  Transaction ||--o{ TransactionLine : has
  BankAccount ||--o{ BankEntry : has
  Item ||--o{ Bom : "finished good"
  Bom ||--o{ BomLine : "raw materials"

  User { string id PK }
  Membership { string userId FK }
  Business { string id PK }
  Party { int openingBalance }
  Item { int salePrice }
  Transaction { enum type }
  TransactionLine { int lineTotal }
  StockMovement { float qty }
  BankAccount { int openingBalance }
  NumberSeries { int next }
```

## 4. Milestone-1 additions (🟦)
```mermaid
erDiagram
  Business ||--o{ Cheque : owns
  Business ||--o{ LoanAccount : owns
  LoanAccount ||--o{ LoanEntry : has
  Item ||--o{ ItemBatch : "batch tracked"
  Item ||--o{ SerialNumber : "serial tracked"
  Godown ||--o{ StockTransfer : from_to
  Business { json settings "🟦 all toggles" }
  Business { string logoUrl "🟦" }
  Item { int wholesalePrice "🟦" }
  Item { string itemCode "🟦" }
  Transaction { string ewayBillNo "🟦" }
  Transaction { json additionalCharges "🟦" }
  Cheque { string status "🟦 open|cleared|bounced" }
  LoanAccount { int balance "🟦" }
  ItemBatch { string batchNo "🟦" }
  SerialNumber { string serial "🟦" }
  StockTransfer { float qty "🟦" }
```

## 5. Field-level additions
| Model | New fields (🟦 Milestone 1) |
|---|---|
| **Business** | `logoUrl, signatureUrl, pincode, stateName, businessCategory, booksBeginDate, settings Json` |
| **Item** | `itemCode, wholesalePrice, imageUrl, taxOnMrp, trackBatch, trackSerial` |
| **StockMovement** | `godownId` |
| **Transaction** | `ewayBillNo, transporterName, vehicleNo, transportDistanceKm, additionalCharges, discountFlat, tcsRate, tcsAmount, tdsRate, tdsAmount, reverseCharge, termsConditions` |
| **Party** | `status, loyaltyPoints` |
| **New** | `Cheque`, `LoanAccount`, `LoanEntry`, `StockTransfer`, `ItemBatch`, `SerialNumber` |

## 6. API surface
n/a — see per-feature docs.

## 7. Key files
- `server/prisma/schema.prisma`
- `shared/types/src/index.ts` (Zod mirror + `settingsSchema`)

## 8. Status vs Vyapar
✅ Core relational model complete and tenant-safe · 🟦 additions above · migrations are additive (nullable/defaulted) → non-destructive `prisma db push`.
