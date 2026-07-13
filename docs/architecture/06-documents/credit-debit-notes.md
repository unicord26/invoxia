# Credit & Debit Notes

## 1. Purpose
**Credit Note** = sales return (reduces a customer's receivable, stock comes back in). **Debit Note** = purchase return (reduces a supplier's payable, stock goes out). Both are `Transaction` types created through the documents router.

## 2. Ecosystem
```mermaid
flowchart LR
  UI["documents (Credit/Debit Note)"] -->|"/api/documents"| R["documentsRouter"]
  R --> CN[("Transaction type=credit_note")]
  R --> DN[("Transaction type=debit_note")]
  CN --> LedC["customer receivable ↓"] & StkIn["stock + qty"]
  DN --> LedD["supplier payable ↓"] & StkOut["stock − qty"]
```

## 3. Architecture
```mermaid
graph TD
  A["credit/debit note form"] --> B["routes/documents.ts"]
  B --> C["prefix CN-n / DN-n"]
  B --> D["stock direction: CN +qty, DN −qty"]
  B --> E["ledger: signedBalanceDelta"]
  E --> F["credit_note −receivable · debit_note +/− payable"]
```

## 4. Data model
```mermaid
erDiagram
  Transaction {
    enum type "credit_note|debit_note"
    string number "CN-n / DN-n"
    int grandTotal
  }
```
Ledger signs (see `lib/ledger.ts`): `credit_note` reduces receivable; `debit_note` reduces payable.

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as note form
  participant R as documentsRouter
  participant P as Prisma
  W->>R: POST /api/documents {type: credit_note, lines}
  R->>P: Transaction + StockMovement(+qty)
  R->>P: ledger delta (− receivable)
  R-->>W: created note
```

## 6. API surface
- `POST /api/documents` (`type = credit_note | debit_note`) · listed via `GET /api/documents?type=`

## 7. Key files
- `client/web/app/documents/page.tsx`
- `server/api/src/routes/documents.ts` · `server/api/src/lib/ledger.ts`

## 8. Status vs Vyapar
✅ Credit/debit notes with stock + ledger reversal, numbering · 🟦 print theme + extras carry-through (Milestone 1) · ⬜ link a note directly to its original invoice/bill line-by-line.
