# Expenses & Payments Out

## 1. Purpose
**Expenses** capture business spending (rent, utilities, etc.) as tax-inclusive amounts with input GST backed out and a category. **Payments Out** record money paid to suppliers against payables. Both are `Transaction` rows (`expense`, `payment_out`).

## 2. Ecosystem
```mermaid
flowchart LR
  Exp["expenses screen"] -->|"POST /api/expenses"| RE["expensesRouter"]
  Pout["party detail / payments"] -->|"POST /api/payments"| RP["paymentsRouter"]
  RE --> DB1[("Transaction type=expense")]
  RP --> DB2[("Transaction type=payment_out")]
  DB1 --> GST["input tax (reports)"]
  DB2 --> Ledger["supplier payable ↓"]
```

## 3. Architecture
```mermaid
graph TD
  A["expenses/page.tsx"] -->|"createExpenseSchema"| B["routes/expenses.ts"]
  B --> C["back out input GST from inclusive amount"]
  B --> D["nextNumber('expense') → EXP-n"]
  B --> E[("Transaction type=expense, category")]
```

## 4. Data model
```mermaid
erDiagram
  Business ||--o{ Transaction : records
  Transaction {
    enum type "expense|payment_out"
    string category "expense head"
    int subTotal
    int totalTax "input GST"
    int grandTotal
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as expense form
  participant R as expensesRouter
  participant P as Prisma
  W->>R: POST /api/expenses {category, amount(incl), taxRate}
  R->>R: taxable = amount / (1+rate); tax = amount − taxable
  R->>P: Transaction(type=expense)
  R-->>W: created (input tax recorded)
```

## 6. API surface
- `GET /api/expenses` · `POST /api/expenses`
- `GET /api/payments` · `POST /api/payments` (payment_out via direction)

## 7. Key files
- `client/web/app/expenses/page.tsx`
- `server/api/src/routes/expenses.ts`, `routes/payments.ts`
- `shared/types` → `createExpenseSchema`, `createPaymentSchema`

## 8. Status vs Vyapar
✅ Expense with category + input GST, payment-out with ledger impact · 🟡 `other_income` type exists in enum but has no create path · ⬜ Fixed Assets, recurring expenses, expense attachments.
