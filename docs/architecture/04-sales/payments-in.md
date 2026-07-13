# Payments In

## 1. Purpose
Records money received from a customer against their outstanding balance. A payment-in is a `Transaction` of type `payment_in` that reduces the party's receivable in the ledger.

## 2. Ecosystem
```mermaid
flowchart LR
  Pay["party detail: record payment"] -->|"POST /api/payments"| R["paymentsRouter"]
  R --> DB[("Transaction type=payment_in")]
  R --> Num["nextNumber('payment_in') → PAY-IN-n"]
  DB --> Ledger["party ledger (− receivable)"]
  DB --> Bank["(optional) bank/cash entry"]
```

## 3. Architecture
```mermaid
graph TD
  A["parties/[id] record-payment form"] -->|"createPaymentSchema"| B["routes/payments.ts"]
  B --> C["nextNumber('payment_in')"]
  B --> D["Prisma Transaction (grandTotal = amount)"]
  D --> E[("Postgres")]
  F["ledger: signedBalanceDelta(payment_in) = − amount"] --> D
```

## 4. Data model
```mermaid
erDiagram
  Party ||--o{ Transaction : pays
  Transaction {
    enum type "payment_in|payment_out"
    string paymentMode "cash|cheque|upi|bank_transfer|card"
    string referenceNo "UTR/cheque no"
    int grandTotal "amount paise"
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as party detail
  participant R as paymentsRouter
  participant P as Prisma
  W->>R: POST /api/payments {partyId, amount, mode, ref}
  R->>R: nextNumber('payment_in')
  R->>P: Transaction(type=payment_in)
  R-->>W: updated ledger balance
```

## 6. API surface
- `GET /api/payments` (payment_in + payment_out) · `POST /api/payments`

## 7. Key files
- `client/web/app/parties/[id]/page.tsx` (record payment)
- `server/api/src/routes/payments.ts` · `lib/ledger.ts` · `lib/numbering.ts`
- `shared/types` → `createPaymentSchema`

## 8. Status vs Vyapar
✅ Payment-in/out, mode + reference, ledger impact, numbering · 🟦 link payments to specific invoices (bill-wise settlement) is a settings toggle (stored, wired later) · ⬜ discount-during-payment, payment links.
