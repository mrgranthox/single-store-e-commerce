# Admin frontend

React 18 + Vite admin SPA for the store back office. This app owns the `/admin/*` surface, loads runtime config from the backend, authenticates admins against `/api/admin/auth/*`, and renders permission-aware workspaces for catalog, orders, payments, customers, support, content, security, and system operations.

The app is catalog-driven: routes, endpoint contracts, permission hints, and Stitch export mappings live in source and are expected to stay in sync.

## Stack

- React 18 + TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Zustand, React Hook Form, Zod
- Optional Sentry frontend observability
- Playwright for E2E and accessibility checks

## Local setup

1. `cd admin-frontend`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Start the backend on `http://127.0.0.1:4000`
5. Ensure backend CORS allows `http://localhost:5174`
6. Run `npm run dev`

Vite serves the app on `http://localhost:5174` and proxies `/api` to `VITE_DEV_PROXY_TARGET` (default `http://127.0.0.1:4000`).

## Environment variables

All `VITE_*` values are public client config and are replaced at build time.

| Variable | Purpose |
| --- | --- |
| `VITE_APP_ENV_LABEL` | Friendly environment label shown in the UI. |
| `VITE_DEV_PROXY_TARGET` | Local dev proxy target for `/api` requests. |
| `VITE_BACKEND_BASE_URL` | Absolute backend base URL used by runtime config and direct API calls. |
| `VITE_SENTRY_DSN` | Enables Sentry when set. |
| `VITE_SENTRY_ENABLE_IN_DEV` | Allows Sentry to run in local dev when `true`. |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Sentry tracing sample rate. |
| `VITE_APP_RELEASE` | Release label passed to Sentry. |
| `VITE_STITCH_PROJECT_ID` | Optional Stitch project id for design workflow tooling. |

## Admin authentication

The frontend does not ship with a default admin password. Login only works when:

- Clerk has an admin identity with a valid password, and
- the backend `admin_users` table has a row linked to that Clerk user id.

For local bootstrapping, configure the backend and run its seed:

1. Open `backend/.env`.
2. Set `SEED_DEFAULT_ADMIN_EMAIL`.
3. Use one of these options:
   - Set `SEED_DEFAULT_ADMIN_PASSWORD` to let the seed create or update the Clerk user.
   - Set `SEED_DEFAULT_ADMIN_CLERK_USER_ID` if the Clerk user already exists.
4. Optionally set `SEED_DEFAULT_ADMIN_ROLE` (defaults to `super_admin`).
5. From `backend/`, run `npm run seed`.

After that, sign in at `/admin/login`.

Protected routes bootstrap the admin shell with `/api/admin/auth/me`. A `401` clears the session and returns to login, a `403` redirects to `/admin/forbidden`, and sensitive mutations can request a step-up token through `/api/admin/auth/step-up`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port `5174`. |
| `npm run build` | Type-check with project references and build production assets. |
| `npm run preview` | Preview the production build locally. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm run verify:stitch` | Ensure every mapped Stitch export folder contains `code.html` and `screen.png`. |
| `npm run verify:contracts` | Check route contracts, endpoint ids, runtime API usage, and RBAC permission parity against the backend. |
| `npm run verify:admin-quality` | Confirm required admin quality fixtures and accessibility guards are present. |
| `npm run verify:perf-budget` | Enforce bundle-size limits against `dist/assets`. |
| `npm run verify` | Run Stitch and contract verification together. |
| `npm run verify:enterprise` | Run verification plus admin quality checks and type-checking. |
| `npm run test:e2e:install` | Install Playwright Chromium dependencies. |
| `npm run test:e2e` | Run E2E tests. Starts its own Vite server on port `4174`. |
| `npm run test:a11y` | Run Playwright tests tagged `@a11y`. |
| `npm run test:perf` | Build and enforce the JS performance budget. |

## Project map

- `src/app/router.tsx`: builds the browser router and protected/public admin routes.
- `src/app/lazy-admin-routes.tsx`: lazy-loads feature pages from `src/features/**`.
- `src/app/providers.tsx`: configures the shared TanStack Query client and global error capture.
- `src/features/auth/*`: login, forgot/reset password, bootstrap state, sessions, and step-up flows.
- `src/lib/contracts/admin-screen-catalog.ts`: route catalog, actions, and permission hints.
- `src/lib/contracts/admin-endpoints.ts`: frontend endpoint inventory used by parity checks.
- `src/lib/stitch/stitch-screen-map.ts`: maps screen ids to design export slugs.
- `src/components/layout/AdminShell.tsx`: primary admin shell chrome.
- `docs/admin frontend UI /`: design system docs and exported Stitch HTML/screenshot source files.

## Stitch implementation workflow

Use `docs/admin frontend UI /` as the design source of truth for this app.

1. Start from the route entry in `src/lib/contracts/admin-screen-catalog.ts`.
2. Find the mapped export slug in `src/lib/stitch/stitch-screen-map.ts`.
3. Port the matching `docs/admin frontend UI /stitch/<slug>/code.html` into React using existing primitives.
4. Keep the route catalog, endpoint contract, and Stitch map aligned.
5. Run `npm run verify:stitch` and `npm run verify:contracts` after changing screen mappings or API wiring.

## Deployment

The app is configured for static SPA deployment on Netlify:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA fallback: `netlify.toml` and `public/_redirects` both route unknown paths to `index.html`

`VITE_*` values are intentionally treated as public build-time configuration, not server secrets.
