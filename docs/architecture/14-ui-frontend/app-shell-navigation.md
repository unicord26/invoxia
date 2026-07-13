# App Shell & Navigation

## 1. Purpose
The persistent authenticated layout: a left sidebar (branding, firm switcher, grouped nav, user footer) with a mobile drawer. Milestone 1 rebuilds the flat 13-item nav into a **grouped, collapsible sidebar** (mirroring Vyapar's sub-menus) driven by a single nav config, using shadcn primitives.

## 2. Ecosystem
```mermaid
flowchart LR
  Prov["providers.tsx: AuthGate + QueryClient"] --> Shell["app-shell.tsx 🟦"]
  Nav["lib/nav.ts (single grouped config) 🟦"] --> Shell
  Nav --> Dash["dashboard module cards (same source)"]
  Shell --> FS["FirmSwitcher (shadcn DropdownMenu) 🟦"]
  Shell --> Pages["<main> {children}"]
```

## 3. Architecture
```mermaid
graph TD
  A["AuthGate (auth logic unchanged)"] --> B{"public route?"}
  B -->|"/login, /store/*"| C["render children only"]
  B -->|authed| D["AppShell"]
  D --> E["Sidebar: brand + FirmSwitcher + Collapsible groups"]
  D --> F["mobile: Sheet drawer"]
  E --> G["nav from lib/nav.ts (Dashboard, Parties, Sale▾, Purchase▾, Cash&Bank▾, ...)"]
  D --> H["<main> page content"]
```

## 4. Data model
No DB. Nav config is a typed structure in `lib/nav.ts` (groups → items → {href, label, icon}). Firm selection persisted in `localStorage["leafx.businessId"]`.

## 5. Key flows
Firm switch without hard reload (planned):
```mermaid
sequenceDiagram
  participant U as User
  participant FS as FirmSwitcher
  participant Q as QueryClient
  U->>FS: pick firm (DropdownMenu)
  FS->>FS: localStorage.set(leafx.businessId)
  FS->>Q: invalidateQueries() + router.refresh()
  Note over Q: data refetched with new x-business-id header
```

## 6. API surface
- `GET /api/businesses` (firm list) · consumed by FirmSwitcher.

## 7. Key files
- `client/web/app/providers.tsx` (AuthGate — keep auth, delegate layout)
- `client/web/components/app-shell.tsx` (🟦 new) · `client/web/lib/nav.ts` (🟦 new)
- `client/web/app/firm-switcher.tsx` · `client/web/app/page.tsx` (dashboard from same nav)

## 8. Status vs Vyapar
✅ Persistent sidebar + mobile drawer, active states, firm switcher (native select + reload today) · 🟦 grouped collapsible nav, single nav source, shadcn DropdownMenu switcher, no hard reload, lucide icons (Task 3) · ⬜ collapsible-to-rail, command palette, breadcrumbs.
