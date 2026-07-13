# Bank Accounts & Cash

## 1. Purpose
Tracks money balances across bank/cash/UPI accounts. Balance = `openingBalance + Σ signed BankEntry`. Supports deposits, withdrawals, and transfers between accounts. Cash-in-hand is modeled as a `BankAccount` of type `cash`.

## 2. Ecosystem
```mermaid
flowchart LR
  UI["bank/page.tsx"] -->|"/api/bank"| R["bankRouter"]
  R --> Acc[("BankAccount")]
  R --> Ent[("BankEntry (signed)")]
  Xfer["transfer"] -->|"paired entries"| Ent
  Dash["dashboard: Cash & Bank total"] --> Ent
```

## 3. Architecture
```mermaid
graph TD
  A["bank/page.tsx"] --> B["routes/bank.ts"]
  B --> C["balances(): groupBy accountId Σ amount"]
  B --> D["create account / entry / transfer"]
  D --> E[("Postgres")]
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ BankAccount : owns
  BankAccount ||--o{ BankEntry : has
  BankAccount {
    string name
    string type "bank|cash|upi"
    string accountNo
    string ifsc
    int openingBalance
  }
  BankEntry {
    int amount "signed paise"
    string kind "deposit|withdraw|transfer_in|transfer_out"
    date date
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as bank UI
  participant R as bankRouter
  participant P as Prisma
  W->>R: POST /api/bank/transfer {fromId,toId,amount}
  R->>P: BankEntry(−amount, transfer_out, from)
  R->>P: BankEntry(+amount, transfer_in, to)
  R-->>W: ok (both balances updated)
```

## 6. API surface
- `GET /api/bank` (accounts + computed balance) · `POST /api/bank` · `POST /api/bank/:id/entry` · `POST /api/bank/transfer`

## 7. Key files
- `client/web/app/bank/page.tsx`
- `server/api/src/routes/bank.ts`

## 8. Status vs Vyapar
✅ Bank/cash/UPI accounts, deposit/withdraw/transfer, dashboard total · 🟡 cash-in-hand is only an account type · 🟦 Cheques + Loan accounts as first-class features → [cheques-and-loans](cheques-and-loans.md) (Milestone 1) · ⬜ bank reconciliation, statement import.
