# Admin frontend (Vite + React)

Enterprise admin SPA: **React**, **Vite**, **React Router**, **TanStack Query**, **Tailwind**. **Not Next.js** — no App Router or `next/*`.

## UI source of truth (Stitch + design system)

All visual spec and batch prompts live under:

**`docs/admin frontend UI /`**

| File / folder | Use |
|---------------|-----|
| **`README.md`** | How this folder ties to the app, Stitch exports, and MCP. |
| **`DESIGN.md`** | Canonical design system (import into every Stitch batch). |
| **`stitch-batch-prompts-all-94-screens.md`** | 19 prompts × 94 screens. |
| **`stitch/<slug>/`** | Per-screen `code.html`, `screen.png`, etc. |

Each catalog screen id maps to a Stitch folder in **`src/lib/stitch/stitch-screen-map.ts`**. Placeholder routes render **`ScreenScaffoldPage`**, which shows backend contract + **repo paths** to the matching Stitch export.

### Cursor: Stitch MCP

The **user-stitch** server provides `list_projects`, `list_screens`, `get_screen`, design-system tools, etc. Check tool schemas under the MCP descriptors before calling. Start from **`docs/admin frontend UI /README.md`**.

## Code map

- **`src/lib/contracts/admin-endpoints.ts`** — admin API inventory.
- **`src/lib/contracts/admin-screen-catalog.ts`** — 94 screens (path, endpoints, actions, permissions).
- **`src/lib/stitch/stitch-screen-map.ts`** — screen id → Stitch export slug.
- **`src/app/router.tsx`** — routes from the catalog.
- **`src/components/layout/AdminShell.tsx`** — sidebar + header shell (aligned with DESIGN.md).
- **`src/components/primitives/*`** — shared UI building blocks.
- **`src/features/auth/pages/*`** — login, forgot/reset password, forbidden, profile/security.

## Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

## Local API (Vite dev)

`vite.config.js` proxies **`/api`** → **`http://127.0.0.1:4000`** so the SPA can call `/api/...` on the same origin as the dev server (`localhost:5174`). Run the backend on port **4000** (default), or set **`VITE_DEV_PROXY_TARGET`** in `.env` (see `.env.example`).

Backend must allow the admin origin in **CORS** (e.g. `http://localhost:5174` in `CORS_ALLOWED_ORIGINS`).

## Admin sign-in (Clerk + database)

There is **no default password in the repo**. Login verifies the password with **Clerk** and requires an **`admin_users`** row linked by `clerk_admin_user_id`.

1. In **Clerk Dashboard**, create a user (or pick an existing one) and set a **password** (or use Clerk’s password reset).
2. Copy that user’s **Clerk user id** (`user_...`).
3. In **`backend/.env`**, set **`SEED_DEFAULT_ADMIN_EMAIL`** (same email as in Clerk) and **`SEED_DEFAULT_ADMIN_CLERK_USER_ID`** (the `user_...` id). Optionally set **`SEED_DEFAULT_ADMIN_ROLE`** (default `super_admin`).
4. From **`backend/`**, run **`npm run seed`** so roles/permissions exist and the admin user is linked to **`super_admin`** (or your role).

Then sign in at **`/admin/login`** with that **email** and **password**.

## Implementation order

1. Follow **DESIGN.md** tokens and patterns when replacing scaffolds.
2. Open the Stitch **`code.html`** for the screen (paths shown on the scaffold).
3. Rebuild in React with primitives; wire TanStack Query to the listed endpoints.
4. Enforce **permission hints** in the UI; backend remains authoritative.
