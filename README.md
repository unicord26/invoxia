# 🍃 Invoixe — Modern GST Billing & Inventory Suite

<div align="center">
  <img src="client/web/public/logo.png" alt="Invoixe Logo" width="160" height="160" style="border-radius: 50%; box-shadow: 0 10px 25px rgba(0,0,0,0.15);" />
  
  <p align="center">
    <strong>A premium, multi-tenant GST Billing, POS, Accounting & Inventory platform for Indian SMEs.</strong>
  </p>

  <p align="center">
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Frontend-Next.js%2015-000000?style=for-the-badge&logo=nextdotjs" alt="Next.js" /></a>
    <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/Backend-NestJS%2011-E0234E?style=for-the-badge&logo=nestjs" alt="NestJS" /></a>
    <a href="https://prisma.io/"><img src="https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma" alt="Prisma" /></a>
    <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Services-Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" /></a>
  </p>
</div>

---

## 🚀 Welcome to Invoixe

Invoixe is a comprehensive desktop-first and mobile-responsive billing platform designed to digitize Indian small and medium enterprises (SMEs). Inspired by the features of Vyapar, Invoixe simplifies retail invoicing, wholesale trade, inventory tracking, POS counter billing, attendance/payroll, and GST reporting.

### 🌟 Core Product Features

*   **⚡ Supercharged POS Billing Terminal:** Rapid counter checkouts with full screen utilization, dynamic real-database category filtering, real-time product search, single-line cart item rows, instant payment calculation, and printable thermal receipts.
*   **📑 Compliant Invoicing & Documents Suite:** Auto-calculates CGST + SGST (intrastate) or IGST (interstate) based on buyer-seller state configurations. Create and manage Estimates, Proformas, Sale Orders, Purchase Orders, Delivery Challans, Credit Notes, and Debit Notes with one-click **⚡ Convert to Invoice** action.
*   **📦 Advanced Inventory Engine:** Strictly separate Finished Product Lists from Raw Materials. Define products and services with tax-inclusive/exclusive pricing structures, assign custom SKUs/codes, track live stock counts (`184,420 PCS`), and manage batch expiries or unique serial numbers.
*   **👥 Dual-Party Ledger:** Maintain active customer and supplier profiles, set credit limits or grace periods, track opening balances, verify GSTINs, and generate ledger balance statements.
*   **👷 Employee Management & Optimistic Attendance:** Full employee lifecycle management with 0ms optimistic UI updates — Daily Attendance Logger (Present, Absent, Half Day, Paid Leave), Monthly Matrix Heatmap, LOP & Salary Auditor, and real-time Attendance-to-Payroll Salary Payout modal with amount-in-words conversion.
*   **🏢 Multi-Tenant Workspaces:** Create and toggle between multiple business profiles securely. Each tenant has isolated database references, dedicated storage buckets, configuration rules, and staff access controls.
*   **📊 Timeframe Dashboard Analytics:** Interactive home dashboard with range-based filters (1D, 7D, 1M, 1Y, 5Y, All) updating Today's Sales, Gross Profit, and the Sales vs Expense trend graph in real-time from the database.
*   **🏭 Manufacturing & BOM Recipes:** Log raw material consumption, work-in-progress batches, and finished goods production runs linked via automated Bill of Materials (BOM) recipes across godowns.

---

## 📁 Monorepo Workspace Directory

Invoixe is organized as a unified monorepo leveraging npm workspaces:

```text
├── client/
│   └── web/                 # @invoixe/web   — Next.js 15 app (Dashboard, POS, Ledgers)
│       ├── app/             #   Routes (App Router); each folder is a URL segment
│       │   ├── employees/   #   Employee directory, Attendance Logger & Payroll Suite
│       │   ├── pos/         #   Supercharged POS Billing Terminal
│       │   ├── documents/   #   Estimates, Sale Orders, Purchase Orders & Documents Suite
│       │   ├── items/       #   Product List & Raw Items inventory pages
│       │   ├── manufacturing/#  Manufacturing batch & BOM tracking pages
│       │   ├── parties/     #   Customer & supplier party ledger pages
│       │   ├── invoices/    #   Invoice listing, Thermal & PDF preview pages
│       │   ├── godowns/     #   Godown (warehouse) management pages
│       │   └── bank/        #   Bank accounts & cheque management pages
│       ├── components/      #   App components (kebab-case files)
│       │   ├── dashboard-metrics.tsx  # KPI cards, trend graph, activity feed
│       │   ├── app-shell.tsx          # Sidebar nav with employee section
│       │   └── ui/          #   Vendored shadcn/ui primitives
│       ├── lib/             #   Browser-side helpers: API client, Supabase, CSV, nav
│       └── public/          #   Static assets served at the site root
├── server/
│   ├── api/                 # @invoixe/api  — NestJS REST API
│   │   ├── build.mjs        #   Production bundle configuration
│   │   └── src/
│   │       ├── employees/   #   Employee & Attendance CRUD controller + service
│   │       ├── items/       #   Items & stock management endpoints
│   │       ├── reports/     #   Dashboard KPI, trend, summary, GST, stock endpoints
│   │       ├── <resource>/  #   One module per resource (controller + service)
│   │       ├── common/      #   Prisma module, Supabase auth guard, Zod validation pipe
│   │       └── lib/         #   Auth types, tenancy, ledger, numbering, stock helpers
│   ├── db/                  # @invoixe/db   — Prisma client, re-exported for both sides
│   └── prisma/              #   schema.prisma + rls.sql (row-level security policies)
├── shared/
│   ├── core/                # @invoixe/core   — GST tax engine, money math & inWordsINR helper
│   ├── types/               # @invoixe/types  — Zod schemas + inferred TypeScript types
│   └── config/              # @invoixe/config — Shared Tailwind preset & tsconfig base
├── scripts/                 # Standalone database seed scripts
│   ├── seed-employees.mjs   #   Seeds 10 realistic employee profiles & attendance logs
│   └── seed-items.mjs       #   Seeds 5 Finished Products, 12 Raw Materials & BOM recipes
└── package.json             # Workspace definitions & root scripts
```

---

## 📐 Recent Changes

### v0.3 — July 2026

| Area | Change |
|------|--------|
| **POS Billing Terminal** | Ground-up redesign (`/pos`) with full-width responsive layout, real DB category tabs, real formatted stock (`184,420 PCS`), single-line cart item rows, and thermal receipt modal |
| **Estimates & Orders** | Complete commercial document suite (`/documents`) supporting Estimates, Proformas, Sale Orders, Purchase Orders, Delivery Challans, Credit & Debit Notes with ⚡ Convert to Invoice |
| **Inventory Separation** | Strict separation between Product List (`/items` — finished goods only) and Raw Items (`/items?category=raw` — raw materials only) |
| **Attendance & Payroll** | 0ms Optimistic UI updates for daily attendance marking, Monthly Matrix Heatmap, LOP Auditor, and Attendance-to-Payout Salary modal with Indian Rupees in words |
| **Items Seed Script** | `scripts/seed-items.mjs` script added to seed 5 Finished Goods, 12 Raw Materials, 4 Categories, and 5 BOM manufacturing recipes |
| **Employees Seed Script** | `scripts/seed-employees.mjs` script added to seed 10 employee profiles with realistic history and payroll entries |

---

### v0.2 — July 2026

| Area | Change |
|------|--------|
| **Employee Management** | New full module — list, create, edit, archive employees with payroll, contacts, and status tracking |
| **Dashboard Filters** | Global 1D/7D/1M/1Y/5Y/All range selectors updating Sales, Gross Profit, and Trend graph dynamically via real-time DB queries |
| **Invoice Print Preview** | Complete redesign — clean typography, monospace number columns, billing address card, symmetrical footer |
| **Parties Page** | Redesigned from scratch with top-level KPI stats, customer/supplier segmentation, and action menus |
| **Manufacturing Page** | Redesigned with flat, structured UI — raw materials, WIP batches, and finished goods tracking |