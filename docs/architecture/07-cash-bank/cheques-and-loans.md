# Cheques & Loan Accounts (Planned — Milestone 1)

## 1. Purpose
Two first-class Cash & Bank features being added in Milestone 1:
- **Cheques** — track received/issued cheques through their lifecycle (open → deposited → cleared → bounced).
- **Loan Accounts** — track borrowings with principal, running balance, interest, and EMI/charge entries.

## 2. Ecosystem
```mermaid
flowchart LR
  ChUI["Cash & Bank → Cheques 🟦"] -->|"/api/cheques"| ChR["chequesRouter 🟦"]
  ChR --> Ch[("Cheque 🟦")]
  Ch -.->|"on clear"| Bank["BankEntry (optional)"]
  LnUI["Cash & Bank → Loans 🟦"] -->|"/api/loans"| LnR["loansRouter 🟦"]
  LnR --> Ln[("LoanAccount 🟦")]
  Ln ||--o{ LnE["LoanEntry 🟦"]:has
```

## 3. Architecture
```mermaid
graph TD
  A["cheques table + status actions"] --> B["/api/cheques"]
  B --> C["state machine: open→deposited→cleared|bounced"]
  D["loans list + entry dialog"] --> E["/api/loans"]
  E --> F["balance −= emi principal portion"]
  C & F --> G[("Postgres")]
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ Cheque : owns
  Business ||--o{ LoanAccount : owns
  LoanAccount ||--o{ LoanEntry : has
  Cheque {
    string chequeNo "🟦"
    int amount "🟦 paise"
    string direction "🟦 received|issued"
    string status "🟦 open|deposited|cleared|bounced"
    date dueDate "🟦"
    string partyId "🟦"
    string bankAccountId "🟦"
  }
  LoanAccount {
    string lender "🟦"
    int principal "🟦"
    int balance "🟦"
    float interestRate "🟦"
    date startDate "🟦"
  }
  LoanEntry {
    int amount "🟦"
    string kind "🟦 emi|charge|disbursement"
    date date "🟦"
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as cheque list
  participant R as chequesRouter
  participant P as Prisma
  W->>R: PATCH /api/cheques/:id {status: cleared}
  R->>R: validate transition (open/deposited → cleared)
  R->>P: Cheque.status = cleared
  R-->>W: updated badge
```

## 6. API surface (planned)
- `GET/POST /api/cheques` · `PATCH /api/cheques/:id` (status)
- `GET/POST /api/loans` · `POST /api/loans/:id/entry`

## 7. Key files (planned)
- `server/api/src/routes/cheques.ts`, `routes/loans.ts` (new)
- `client/web/app/bank/cheques/…`, `app/bank/loans/…` (new, or tabs under bank)
- `server/prisma/schema.prisma` — `Cheque`, `LoanAccount`, `LoanEntry`

## 8. Status vs Vyapar
🟦 Planned in Milestone 1 (broadened scope, Tasks 15) · ⬜ cheque printing, loan amortization schedule, interest auto-posting (M2+).
