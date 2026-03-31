# Admin Frontend Stitch UI Review
Date: 2026-03-28

## Scope Reviewed
- Source folder: `docs/admin frontend UI /stitch`
- Batch prompts: `docs/admin frontend UI /stitch-batch-prompts-all-94-screens.md`
- Design system source of truth: `docs/admin frontend UI /DESIGN.md`
- Export count reviewed:
  - `94` `screen.png` files
  - `94` `code.html` files

This review treats the Stitch outputs as reference material, not as the production source of truth. The production source of truth is the documented admin design system plus the backend-linked admin screen catalog.

## Review Method
- Verified the full export count across the Stitch batch.
- Read the design system and screen-prompt pack.
- Inspected representative generated screens directly from the export HTML:
  - `admin_login`
  - `executive_overview`
  - `product_list`
  - `settings_overview_hub`
  - `reports_overview`
- Extracted batch-wide evidence from the `code.html` files:
  - font usage
  - title naming
  - product branding
  - sidebar/nav labels
- Extracted image-dimension metadata from all `screen.png` files.

## Executive Summary
The Stitch pack is usable as a layout and content reference, but it is not consistent enough to implement literally screen by screen. The main drift appears in product naming, typography, shell layout, nav taxonomy, visual token usage, and capture discipline. The implementation should normalize the entire admin frontend around one canonical shell and one component/token system, then translate each screen into that foundation.

## High-Severity Findings

### 1. Product Branding Drift
The batch does not use one stable product identity.

Observed brand strings across the 94 exports:
- `Command Deck`: `67`
- `Operational Architect`: `58`
- `Enterprise Admin`: `26`
- `The Architect`: `10`
- `Ops Architect`: `8`
- `Architect OS`: `5`
- `Admin Panel`: `4`

Impact:
- The exported screens do not represent one coherent product.
- Header, login, dashboard, settings, and incident screens can feel like different applications.

Decision for implementation:
- Use the design doc as source of truth:
  - product: `Enterprise E-Commerce Admin Panel`
- Use one consistent app-shell wordmark in the frontend scaffold:
  - short UI label: `Enterprise Admin`

### 2. Typography Drift
The design doc specifies:
- headings: `DM Sans`
- body: `IBM Plex Sans`
- mono: `JetBrains Mono`

Observed across the batch:
- `JetBrains Mono`: `93` files
- `IBM Plex Sans`: `90` files
- `Inter`: `83` files
- `Plus Jakarta Sans`: `75` files
- `DM Sans`: `75` files

Observed font combinations:
- `49` files use `DM Sans`, `IBM Plex Sans`, `JetBrains Mono`, `Plus Jakarta Sans`, `Inter`
- `16` files use `DM Sans`, `IBM Plex Sans`, `JetBrains Mono`, `Inter`
- `13` files use `IBM Plex Sans`, `JetBrains Mono`, `Plus Jakarta Sans`, `Inter`

Impact:
- Headings, tables, labels, forms, and dashboard metrics do not share one clear hierarchy.
- The design system was not applied consistently during generation.

Decision for implementation:
- Remove `Inter` and `Plus Jakarta Sans` from the production admin UI.
- Normalize all admin pages to:
  - `DM Sans` for page titles, section titles, KPI values
  - `IBM Plex Sans` for labels, tables, forms, body copy
  - `JetBrains Mono` for IDs, codes, endpoints, timestamps when needed

### 3. App Shell and Sidebar Drift
The design system specifies one fixed sidebar with these groups:
- Overview
- Catalog
- Inventory
- Orders
- Payments
- Customers
- Support
- Content
- Marketing
- Reports
- Security & Audit
- System

The Stitch exports vary in:
- sidebar item count
- group naming
- group order
- inclusion of unrelated sections like `Documentation`, `CRM`, and generic `Analytics`
- presence or absence of user/account controls in the shell

Impact:
- Screens do not feel like they belong to one operational console.
- A literal implementation would create navigation debt immediately.

Decision for implementation:
- Ignore Stitch shell variation.
- Use one canonical sidebar driven from `admin-screen-catalog.ts`.
- Implement every screen inside the same shell.

### 4. Page Title and Header Drift
There are `87` unique `<title>` values across `94` screens, with inconsistent suffixes and naming patterns.

Examples:
- `Inventory Overview | Command Deck`
- `Executive Dashboard | Operational Architect`
- `Reports Overview — Architect OS`
- `Orders Command Deck`
- `Incidents - Security Ops Architect`

Impact:
- Breadcrumb, route title, browser title, and page heading conventions are not stable.

Decision for implementation:
- Normalize page titles to the admin screen catalog.
- Use one page-header pattern:
  - title
  - short description
  - right-side actions
  - optional quick filters

### 5. Color and Surface Drift
The design system is clear:
- dark shell/sidebar
- light content area
- blue primary accent
- neutral white cards

The Stitch screens frequently drift into:
- Material-style blues that do not match the documented primary exactly
- inconsistent tints
- inconsistent dark/light balance
- inconsistent panel elevation and row hover colors

Impact:
- Cross-screen continuity is weak.
- Status colors and action hierarchy may become ambiguous.

Decision for implementation:
- Use the `DESIGN.md` palette and CSS variable tokens as the only production color system.
- Treat Stitch colors as directional only.

### 6. Capture Size and Composition Inconsistency
Only `32` screens share the same export size: `1600 x 1280`.
The rest vary significantly, including:
- `1600 x 1406`
- `1600 x 1378`
- `1600 x 1355`
- `1600 x 1048`
- `1600 x 1112`
- `1584 x 1600`
- `1461 x 1600`

Impact:
- The export batch does not reflect one stable viewport, page density, or content-height rule.
- Some screens were likely generated with different content lengths or inconsistent scroll states.

Decision for implementation:
- Do not treat image height as a layout constraint.
- Reconstruct layouts from structure and hierarchy, not screenshot height.

## Medium-Severity Findings

### 7. Data Density and Table Pattern Drift
Some screens use dense enterprise tables, while others use looser marketing-style cards or hybrid panels for similar data types.

Impact:
- Shared modules like orders, support, inventory, and audit could end up with inconsistent list/detail ergonomics.

Decision for implementation:
- Standardize list screens on a reusable data-table shell.
- Use cards only where the underlying workflow is summary-first or dashboard-first.

### 8. Status Badge Drift
States such as active, completed, pending, failed, cancelled, and warning do not appear to follow one stable badge system across the pack.

Decision for implementation:
- Normalize all status badges to the status scale in `DESIGN.md`.

### 9. Filter and Action Bar Drift
Quick filters, search placement, export actions, primary buttons, and overflow actions move around between screens.

Decision for implementation:
- Use a stable page-header/action-bar composition:
  - left: title and description
  - right: primary action and secondary actions
  - below: optional filter row

### 10. Form Field and Panel Drift
Forms vary in field density, grouping, helper text style, panel radius, and CTA positioning.

Decision for implementation:
- Normalize forms around section cards with consistent label, helper, validation, and submit placement.

## Screen-Family Guidance

### Dashboard Screens
Use Stitch for content composition ideas only. Normalize KPI cards, alert panels, tables, and filter controls around one dashboard system.

### Catalog and Inventory
Use one list-detail-edit language. Product, category, brand, warehouse, and stock screens should share the same page header, list controls, and edit-panel patterns.

### Orders, Payments, Customers, Support
These are operational workflows and should be the most systemized screens in the app. Stitch drift is most dangerous here because inconsistent actions or statuses can mislead operators.

### Content, Marketing, Reports
These screens can keep more visual variation, but still need the same shell, typography, cards, tables, and action placement.

### Security, Audit, System
These should feel more severe and operational. Keep the same shell, but use denser tables, clearer status emphasis, and more obvious escalation paths.

## Production Normalization Rules

### Source of Truth
1. Backend contract and route map
2. Admin screen catalog
3. `DESIGN.md`
4. Stitch exports as layout/content reference only

### Canonical Visual Rules
- One app shell
- One sidebar taxonomy
- One header pattern
- One typography stack
- One color-token set
- One table system
- One status-badge system
- One form layout system

### Canonical Naming Rules
- Use the route and screen title from `admin-screen-catalog.ts`
- Use `Enterprise Admin` in shell branding
- Do not preserve alternate brand names from Stitch exports

## Implementation Scaffold Already Prepared

### Route and Backend Contract Scaffold
- `admin-frontend/src/lib/contracts/admin-endpoints.ts`
- `admin-frontend/src/lib/contracts/admin-screen-catalog.ts`
- `admin-frontend/src/app/router.tsx`

### Design-System-Oriented Scaffold
- `admin-frontend/src/components/layout/AdminShell.tsx`
- `admin-frontend/src/components/primitives/PageHeader.tsx`
- `admin-frontend/src/components/primitives/SurfaceCard.tsx`
- `admin-frontend/src/components/primitives/KpiCard.tsx`
- `admin-frontend/src/components/primitives/StatusBadge.tsx`
- `admin-frontend/src/components/primitives/DataTableShell.tsx`
- `admin-frontend/src/components/ui/ScreenScaffoldPage.tsx`
- `admin-frontend/src/index.css`
- `admin-frontend/tailwind.config.cjs`

These files intentionally normalize the shell and component foundation before any real screen implementation begins.

## Recommended Implementation Strategy
1. Keep the current route catalog and backend contract mapping unchanged.
2. Build one canonical shell and primitive component layer first.
3. Re-implement Stitch screens by feature family, not one-off page by page:
   - auth and shell
   - dashboard
   - catalog
   - inventory
   - orders and shipping
   - payments
   - customers and support
   - content and marketing
   - reports
   - security and system
4. Use the Stitch screens to inform:
   - composition
   - information density
   - module-specific widgets
5. Do not inherit:
   - alternate brand names
   - alternate font stacks
   - alternate nav structures
   - inconsistent export proportions

## Current Conclusion
The Stitch pack is valuable and usable, but it needs normalization before implementation. The right approach is not screen-for-screen cloning. The right approach is controlled translation of all 94 references into one consistent admin design system, which the frontend scaffold now supports.
