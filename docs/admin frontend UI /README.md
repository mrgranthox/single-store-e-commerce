# Admin frontend UI — Stitch, design system, and implementation

This folder is the **canonical UI source-of-truth** for the Vite + React admin app under `admin-frontend/`.

## Contents

| Path | Purpose |
|------|--------|
| **`DESIGN.md`** | Design system: colors, typography, spacing, shell layout, components, motion, empty states. **Import or paste into every Stitch batch** before generating screens (see batch prompts). |
| **`stitch-batch-prompts-all-94-screens.md`** | Nineteen batch prompts covering all **94** admin screens; each batch references the design system. |
| **`stitch/<export_slug>/`** | Exported Stitch outputs: typically `code.html`, `screen.png`, and sometimes `tailwind.config.js` / `globals.css` per screen. Slugs use `snake_case` (e.g. `admin_login`, `product_list`). |

## Implementation app

- **Code:** `admin-frontend/` (React, Vite, React Router, TanStack Query, Tailwind).
- **Contracts:** `admin-frontend/src/lib/contracts/admin-screen-catalog.ts` (94 routes, endpoints, actions) and `admin-endpoints.ts`.
- **Stitch map:** `admin-frontend/src/lib/stitch/stitch-screen-map.ts` maps each catalog **`screen.id`** to a **`stitch/`** folder slug so placeholder pages can show the exact export path while you port HTML → React.

## Google Stitch (MCP in Cursor)

The **user-stitch** MCP exposes tools such as `list_projects`, `list_screens`, `get_screen`, `generate_screen_from_text`, and design-system helpers. Typical flow:

1. **`list_projects`** — pick your Stitch project id.
2. **`list_screens`** — `projectId` (numeric id string, no `projects/` prefix).
3. **`get_screen`** — fetch HTML / metadata for a screen to compare with `stitch/*/code.html` or to regenerate.

Read each tool’s schema under `.cursor/.../mcps/user-stitch/tools/` before calling (required parameters differ per tool).

## Workflow: local dev + porting a screen

1. Run `npm run dev` in `admin-frontend/` (see app README for API proxy env).
2. Open the route from the sidebar; the scaffold page lists endpoints and, when mapped, **repo paths** to the Stitch export.
3. Translate `stitch/<slug>/code.html` into React using existing primitives (`PageHeader`, `SurfaceCard`, `DataTableShell`, `KpiCard`, `StatusBadge`, `AdminShell`).
4. Keep **`DESIGN.md`** tokens and patterns; do not introduce Next.js or RSC.

## Extra Stitch export

`stitch/nexus_operational_console/` has no matching row in the 94-screen catalog (likely an alternate or superseded ops view). Prefer **`operations_control`** for the operations dashboard unless product chooses otherwise.
