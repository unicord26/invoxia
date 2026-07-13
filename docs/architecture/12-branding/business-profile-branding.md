# Business Profile & Branding

## 1. Purpose
The firm's identity used across the app and on printed documents: name, GSTIN/PAN, contact, address, state, and — added in Milestone 1 — **logo**, **signature**, pincode, business type/category, and account-books beginning date. Images are stored in Supabase Storage.

## 2. Ecosystem
```mermaid
flowchart LR
  Prof["settings: Business Profile 🟦"] -->|"PATCH /business/current"| R["businessRouter"]
  R --> DB[("Business")]
  Up["ImageUpload 🟦"] -->|"upload"| ST["Supabase Storage: business-assets 🟦"]
  ST -->|"public URL"| DB
  DB --> Print["invoice header/footer: logo + signature"]
```

## 3. Architecture
```mermaid
graph TD
  A["Business Profile form (2-col Vyapar layout)"] --> B["businessRouter PATCH /current"]
  A --> C["ImageUpload → Supabase Storage (session auth)"]
  C --> D["public URL → logoUrl / signatureUrl"]
  B & D --> E[("Business")]
  E --> F["print templates render logo + signature"]
```

## 4. Data model
```mermaid
erDiagram
  Business {
    string name
    string gstin
    string pan
    string stateCode
    string bankName
    string logoUrl "🟦"
    string signatureUrl "🟦"
    string pincode "🟦"
    string stateName "🟦"
    string businessCategory "🟦"
    date booksBeginDate "🟦"
  }
```

## 5. Key flows
```mermaid
sequenceDiagram
  participant W as profile form
  participant S as Supabase Storage
  participant R as businessRouter
  W->>S: upload logo (bucket business-assets)
  S-->>W: public URL
  W->>R: PATCH /api/business/current {logoUrl, pincode, booksBeginDate, ...}
  R-->>W: saved
  Note over W: next invoice print shows the logo + signature
```

## 6. API surface
- `GET /api/business/current` · `PATCH /api/business/current` (extended fields)
- Image upload: direct browser → Supabase Storage `business-assets` (public URL persisted)

## 7. Key files
- `client/web/app/settings/page.tsx` (Business Profile tab) · `client/web/components/image-upload.tsx` (🟦)
- `server/api/src/routes/business.ts`
- `server/prisma/schema.prisma` — `Business` branding fields

## 8. Status vs Vyapar
✅ Name, GSTIN/PAN, state code, contact, address, bank details · 🟦 logo, signature, pincode, state name, business type/category, books-begin date + on-invoice rendering (Task 13) · ⬜ multiple templates per firm, watermark.
