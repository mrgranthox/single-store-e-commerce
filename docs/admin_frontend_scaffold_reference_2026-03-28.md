# Admin Frontend Scaffold Reference

Date: 2026-03-28

## Source docs used
- `docs/ecommerce_admin_frontend_architecture_72screens.md`
- `docs/ecommerce_admin_page_by_page_ui_spec_72screens.md`
- `docs/ecommerce_admin_expanded_screen_inventory_72screens.md`
- `docs/ecommerce_admin_api_contract_72screens.md`
- `docs/backend_route_catalog_2026-03-28.json`

## What was scaffolded
- Vite + React + TypeScript admin app in `admin-frontend/`
- auth entry screens:
  - login
  - forgot password
  - reset password
  - forbidden
  - profile and session security
- protected admin shell with sidebar and runtime-config bootstrap
- canonical admin endpoint catalog
- canonical 94-screen route and action catalog
- generated router from the route catalog
- generic scaffold screen renderer for every documented admin route

## Canonical files
- `admin-frontend/src/lib/contracts/admin-endpoints.ts`
- `admin-frontend/src/lib/contracts/admin-screen-catalog.ts`
- `admin-frontend/src/app/router.tsx`
- `admin-frontend/src/components/layout/AdminShell.tsx`
- `admin-frontend/src/features/auth/pages/LoginPage.tsx`

## Endpoint and action inventory
The detailed inventory lives in code so it stays implementation-close:
- `admin-endpoints.ts`
  - grouped backend endpoint list for auth, dashboard, catalog, inventory, orders, payments, customers, support, content, marketing, reports, security, and system
- `admin-screen-catalog.ts`
  - screen number
  - screen title
  - frontend route
  - purpose
  - mapped backend endpoints
  - primary actions
  - permission hints

## Intended next step
Use the scaffold route map and screen catalog as the stable information architecture, then replace placeholder screens with UI-specific implementations once design references are provided.
