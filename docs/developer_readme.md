# E-Commerce Platform Developer README
## Setup, environment, local development, and execution guide

This document is the **developer-facing README** for the e-commerce platform.  
It is meant to sit alongside the master system README and focuses on:

- local development setup
- required services
- environment variables
- backend and worker execution
- frontend app execution
- migration and seeding workflow
- operational development rules
- recommended implementation order

This README assumes the current project direction is:

- **94 admin screens**
- **50 customer web screens**
- **48-screen-range mobile support**
- **single-store now**
- **multi-store ready later**
- **no rewards/loyalty now**
- **promotions and coupons included**
- **queue-backed backend**
- **Clerk for authentication**
- **backend-owned RBAC**
- **Redis + BullMQ workers**
- **PostgreSQL + Prisma**

---

# 1. Project structure at a high level

The platform is made of:

- **backend API**
- **background worker(s)**
- **admin frontend**
- **customer frontend**
- **mobile app** later / in parallel
- **shared contracts and environment configuration**

For development, the most important thing is to get the backend foundation correct before deep feature work.

---

# 2. Core technology stack

## Backend
- Node.js
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Zod
- Sentry
- Clerk SDK

## Admin frontend
- React
- TypeScript
- React Router
- TanStack React Query
- React Hook Form
- Zod
- Zustand
- Tailwind CSS
- TanStack Table
- Recharts

## Customer frontend
- React
- TypeScript
- React Router
- TanStack React Query
- React Hook Form + Zod
- Zustand or light UI state
- Tailwind CSS

---

# 3. Required local development services

Before real development begins, these must be working locally:

- **PostgreSQL**
- **Redis**
- **backend API**
- **background worker**
- **Clerk application**
- **Sentry project**

## Why these are mandatory
The platform depends on:
- database-backed business state
- Redis-backed queues and short-lived operational state
- worker-based async processing
- external identity management
- observability from early development onward

---

# 4. Local prerequisites

Install and verify:

## Node.js
Recommended:
- Node.js 20+ preferred
- npm or pnpm

Check:
```bash
node -v
npm -v
```

## PostgreSQL
Make sure PostgreSQL is installed and running locally.

Check:
```bash
psql --version
```

## Redis
Make sure Redis is installed and running locally.

Check:
```bash
redis-cli ping
```

Expected:
```bash
PONG
```

## Git
Check:
```bash
git --version
```

## Optional tools
Helpful but optional:
- Docker / Docker Compose
- TablePlus / DBeaver / pgAdmin
- Redis GUI
- Postman / Insomnia
- ngrok or Cloudflare Tunnel for local webhook testing

---

# 5. Required external accounts

Create these before deep implementation:

## Clerk
Use Clerk for:
- registration
- login
- password reset
- email verification
- session identity

Create:
- one Clerk application for the platform

Collect:
- publishable key
- secret key
- webhook secret

## Sentry
Create:
- one backend Sentry project

Collect:
- DSN

## Payment provider
Use:
- Paystack

Collect sandbox credentials and webhook secret/config values.

## Email provider
Use:
- Brevo

Collect:
- SMTP relay credentials or API key
- sender domain/email identity

## Storage provider
Use:
- Cloudinary

Collect:
- API keys
- upload folder naming

---

# 6. Environment variables

Create a `.env` file for local development.

## Minimum backend environment variables
```env
NODE_ENV=development
PORT=4000

APP_BASE_URL=http://localhost:4000
ADMIN_APP_URL=http://localhost:5174
CUSTOMER_APP_URL=http://localhost:3001
MOBILE_APP_URL=http://localhost:3002
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5174,http://127.0.0.1:5174

DATABASE_URL=postgresql://ecommerce_user:strongpassword@localhost:5432/ecommerce_db
REDIS_URL=redis://localhost:6379

CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

SENTRY_DSN=your_sentry_dsn

PAYMENT_PROVIDER=paystack
PAYSTACK_SECRET_KEY=your_paystack_secret
PAYSTACK_PUBLIC_KEY=your_paystack_public
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
PAYSTACK_ALLOWED_CHANNELS=card,mobile_money
PAYSTACK_ALLOWED_MOBILE_MONEY_PROVIDERS=mtn,tgo,vod

EMAIL_PROVIDER=brevo
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_LOGIN=your_brevo_smtp_login
BREVO_SMTP_PASSWORD=your_brevo_smtp_key
BREVO_API_KEY=optional_brevo_api_key_fallback
EMAIL_FROM=no-reply@example.com

STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_UPLOAD_FOLDER=ecommerce

SESSION_SECRET=replace_with_secure_value
JWT_PRIVATE_KEY_BASE64=replace_if_used
JWT_PUBLIC_KEY_BASE64=replace_if_used

LOG_LEVEL=debug
```

## Important rules
- do not commit `.env`
- keep a `.env.example`
- use descriptive variable names
- never hardcode provider secrets in code

---

# 7. Database setup

## 7.1 Create local database
Example:
```sql
CREATE DATABASE ecommerce_db;
CREATE USER ecommerce_user WITH PASSWORD 'strongpassword';
GRANT ALL PRIVILEGES ON DATABASE ecommerce_db TO ecommerce_user;
```

## 7.2 Prisma setup
Run:
```bash
npx prisma generate
npx prisma migrate dev
```

## 7.3 Seed data
Create and maintain seed scripts for:
- roles
- permissions
- default admin user
- runtime settings
- optional sample catalog data

Run:
```bash
npm run seed
```

## 7.4 Development rules
- all schema changes go through Prisma migrations
- do not manually mutate production-like schema without migration records
- treat database changes as contract changes

---

# 8. Redis and BullMQ setup

## 8.1 Redis role
Redis is used for:
- BullMQ queue backing
- short-lived cache
- rate-limit counters
- idempotency helpers
- ephemeral workflow state

## 8.2 BullMQ role
BullMQ is used for:
- queue creation
- retries
- delayed jobs
- concurrency control
- worker processing

## 8.3 Required local job categories
At minimum, stand up queue infrastructure for:
- payment processing
- webhook processing
- notifications
- reconciliation / cleanup

## 8.4 Development rule
Even in local development:
- do not fake async behavior in controllers
- enqueue jobs properly
- run a worker process properly
- test failures and retries early

---

# 9. Running the backend API

## 9.1 Install dependencies
```bash
npm install
```

## 9.2 Start development server
Example:
```bash
npm run dev
```

Expected development responsibilities of the API:
- auth/session verification
- request validation
- business logic execution
- database interaction
- job enqueueing
- health endpoints
- structured error responses

## 9.3 Health endpoints
At minimum:
- `/health`
- `/ready`

Use them during development to confirm:
- app booted
- DB connectivity
- Redis connectivity
- essential provider configuration availability where appropriate

---

# 10. Running the worker

## 10.1 Worker concept
A worker is a separate Node.js process that consumes jobs from BullMQ via Redis.

It is **your code**, but it must still run as a separate process.

## 10.2 Start the worker
Example:
```bash
npm run worker:dev
```

## 10.3 Expected worker responsibilities
Workers should handle:
- payment verification follow-up
- webhook processing
- notification dispatch
- retryable integration actions
- cleanup and reconciliation jobs

## 10.4 Minimum local verification
Before real feature development, confirm:
- API can enqueue a job
- worker consumes the job
- failed jobs are visible
- retries work
- duplicate processing is handled safely

---

# 11. Clerk integration rules

## 11.1 Use Clerk only for authentication
Clerk handles:
- login
- registration
- password reset
- email verification
- session identity

## 11.2 Backend remains source of truth for authorization
Your backend must own:
- roles
- permissions
- admin status
- customer status
- suspension/deactivation
- action-level authorization

## 11.3 Identity mapping
The backend should store:
- `clerk_user_id`
- user/admin profile linkage
- business status flags
- role assignments

## 11.4 Local development checklist
Before auth-heavy feature development:
- Clerk app is created
- keys are configured
- frontend can authenticate
- backend can verify identity
- backend can resolve user/admin record from Clerk identity

---

# 12. RBAC requirements before admin feature work

Before building real admin flows, the following must already exist:

- roles table
- permissions table
- role_permissions table
- user_roles table
- seed script for initial roles
- backend middleware for permission checks

## Admin role families
- super admin
- platform admin
- catalog manager
- inventory manager
- fulfillment manager
- finance admin
- support lead
- support agent
- content and marketing manager
- analyst / read-only admin

## Rule
Frontend hiding of actions is not enough.  
Backend must reject unauthorized actions even if the UI is bypassed.

---

# 13. Sentry and observability setup

## 13.1 Initialize Sentry early
Do this before major feature work.

Use it for:
- unhandled exceptions
- provider integration failures
- worker crashes
- unexpected runtime failures

## 13.2 Structured logging
Also add:
- request IDs
- actor IDs when known
- module name
- action name
- duration
- status/result
- error classification

## 13.3 Minimum observability baseline
Have these before serious implementation:
- Sentry DSN configured
- one test exception captured
- structured console logs working
- `/health`
- `/ready`

---

# 14. Local webhook testing

For local development, webhook-consuming integrations must still be testable.

## Recommended options
- ngrok
- Cloudflare Tunnel

## Use cases
- Paystack webhook testing
- Clerk webhook testing
- other provider callbacks

## Required webhook behavior
Webhook handling should:
1. receive request
2. verify signature
3. store raw event
4. respond quickly
5. enqueue worker processing
6. mark final result after processing

Do not do heavy webhook work inline inside the controller.

---

# 15. Required backend conventions

The backend should use shared conventions from the beginning.

## 15.1 Response envelope
Success:
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## 15.2 Validation
Use Zod or equivalent for:
- request bodies
- params
- query strings
- provider payload validation where needed

## 15.3 Pagination
Use consistent query params:
- `page`
- `pageSize`
- `sortBy`
- `sortOrder`

## 15.4 Sensitive actions
Sensitive admin operations must include:
- permission checks
- optional reason capture
- audit log write
- admin action log if before/after changes matter

---

# 16. Queue and worker design conventions

## Recommended queue separation
Use named queues for clarity:
- `payments`
- `webhooks`
- `notifications`
- `reconciliation`

## Job naming examples
- `verify-payment`
- `process-payment-webhook`
- `send-order-confirmation-email`
- `expire-stock-reservation`
- `reconcile-stuck-payments`

## Retry design
Use:
- bounded retries
- exponential backoff
- dead-letter strategy or equivalent status handling

## Idempotency
Required for:
- checkout creation
- payment initialization
- webhook processing
- refund operations where duplicate execution is dangerous

---

# 17. Implementation order

Use this execution order.

## Phase 0 — Foundation
Build and verify:
- Postgres + Prisma
- Redis + BullMQ
- worker baseline
- Clerk integration
- RBAC seeds and permission middleware
- Sentry + health/readiness
- shared error/response/validation utilities

## Phase 1 — Core commerce
Build:
- catalog
- categories/brands
- inventory
- carts
- checkout
- orders
- payments

## Phase 2 — Post-purchase and service
Build:
- returns
- refunds
- customers
- support
- notifications

## Phase 3 — Governance and observability
Build:
- audit logs
- admin action logs
- security events
- alerts/incidents
- settings
- webhook monitoring
- jobs monitor
- reconciliation jobs

## Phase 4 — Reporting and optimization
Build:
- analytics events
- reports
- performance hardening
- caching improvements
- deeper test coverage

---

# 18. Frontend development startup rules

## Admin frontend
Before deep page building:
- auth/session integration works
- permission-aware navigation works
- API client is stable
- table/filter primitives exist
- confirmation dialog system exists

## Customer frontend
Before deep journey work:
- product discovery routes exist
- auth/session restoration works
- cart state works
- checkout validation contract is ready
- backend eligibility flags are respected

## Rule
Do not hardcode business truth in frontend components.  
Always consume backend-driven flags for:
- checkout
- returns
- refunds
- review eligibility
- cancellation eligibility
- support actions

---

# 19. Development commands example

These are example commands only. Adjust to actual package manager and scripts.

## Backend
```bash
npm install
npm run dev
npm run worker:dev
npx prisma generate
npx prisma migrate dev
npm run seed
```

## Admin frontend
```bash
npm install
npm run dev
```

## Customer frontend
```bash
npm install
npm run dev
```

---

# 20. Development checklist before real module work

Complete this before building major features:

- PostgreSQL runs locally
- Redis runs locally
- Prisma connects successfully
- migrations run successfully
- seed script works
- API boots successfully
- worker boots successfully
- API can enqueue a job
- worker can process a job
- Clerk app is configured
- backend can verify Clerk identity
- RBAC tables and seeds exist
- permission middleware exists
- Sentry captures test errors
- health/readiness endpoints work
- `.env.example` exists
- local webhook tunnel option is ready

If these are not done, feature development will bottleneck later.

---

# 21. Operational warnings

Do not:
- postpone Redis until later
- skip the worker until payment work begins
- build admin screens before RBAC
- trust frontend payment success
- implement webhook logic without idempotency
- put all business logic inside controllers
- let frontend invent eligibility rules
- ignore audit logging for sensitive actions

---

# 22. Relation to the master README

Use the **master README** for:
- whole-system orientation
- scope alignment
- feature boundaries
- screen counts
- architectural direction

Use **this developer README** for:
- setup
- execution
- environment configuration
- local running
- implementation sequencing

---

# 23. Final note

The correct mindset for this platform is:

- foundation first
- contracts first
- workers early
- backend truth always
- admin safety always
- payments and inventory treated as high-risk domains
- promotions and coupons included
- loyalty/rewards intentionally deferred

This keeps the implementation aligned with the actual scope and avoids the most common rebuild mistakes.
