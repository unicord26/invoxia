# UI Architecture (shadcn/ui)

## 1. Purpose
The frontend design system. Migrated from hand-rolled Tailwind (repeated inline classes, `window.prompt` dialogs, inline SVGs) to **shadcn/ui** primitives (Radix + CVA + lucide) themed to the Leafx green brand — accessible, consistent, owned-in-repo components. Shipped in Milestone 1.

## 2. Ecosystem
```mermaid
flowchart LR
  Tokens["globals.css CSS vars + tailwind preset"] --> UI["components/ui/* (shadcn — 23 primitives shipped)"]
  UI --> Screens["app/**/page.tsx"]
  Shared["components/: page-header, data-table, form-field, money-input, image-upload, combobox, import-wizard, connection-status"] --> Screens
  Query["TanStack Query + lib/api.ts"] --> Screens
```

## 3. Architecture
```mermaid
graph TD
  A["shadcn init: components.json + lib/utils(cn)"] --> B["tokens: --primary=green, --destructive=red, slate neutrals"]
  B --> C["preset maps hsl(var(--x)); keep raw green/red scales"]
  C --> D["generate primitives: button/input/dialog/tabs/table/select/card/..."]
  D --> E["shared composite components"]
  E --> F["migrate screens: dashboard, parties, items, invoice builder"]
```

## 4. Token reconciliation
```mermaid
graph LR
  V["CSS vars (HSL) in globals.css"] --> P["--primary=#16A34A green"]
  V --> S["--secondary/--muted=slate"]
  V --> D["--destructive=#DC2626 red"]
  V --> R["--radius=0.625rem"]
  P & S & D & R --> T["tailwind preset: primary/secondary/... = hsl(var(--x))"]
  note["keep raw green/red numeric scales for existing text-green-600 etc."]
```
Collision note: the preset currently defines `primary`/`secondary` as hex objects — replaced with the CSS-var form so shadcn components render green by default; audit the few `bg-primary`/`bg-secondary` usages during migration.

## 5. Key flows
Component consumption:
```mermaid
sequenceDiagram
  participant Dev
  participant CLI as "npx shadcn add"
  participant Repo as components/ui
  Dev->>CLI: add button input dialog tabs table ...
  CLI->>Repo: write primitive source (owned)
  Dev->>Repo: import { Button } from "@/components/ui/button"
```

## 6. API surface
n/a (frontend only).

## 7. Key files
- `client/web/components.json`, `client/web/lib/utils.ts` (`cn`)
- `client/web/app/globals.css` (tokens), `shared/config/tailwind-preset.js`
- `client/web/components/ui/*` (23 shadcn primitives), `client/web/components/*` (composites)

## 8. Status vs Vyapar
✅ Milestone 1 shipped: shadcn foundation (23 primitives), app-shell, collapsible sidebar + FirmSwitcher, shared composites (page-header/data-table/form-field/money-input/image-upload/combobox/import-wizard), settings/parties/items/invoice screens migrated · ⬜ Dark-mode toggle, Storybook, full-page migration for all secondary screens (M2+).
