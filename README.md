# Enterprise E-Commerce Platform

> Single-store operational e-commerce platform built with Node.js, Express, Prisma, PostgreSQL, Redis, BullMQ, and React. Architected with a modular monolith backend, full asynchronous worker queue layer, 94-screen admin operations panel, and 50-screen customer web portal.

[![Backend CI](https://github.com/mrgranthox/multi-store-react-native/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/mrgranthox/multi-store-react-native/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/mrgranthox/multi-store-react-native/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/mrgranthox/multi-store-react-native/actions/workflows/frontend-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)
- [Open Questions](#open-questions)

---

## Overview

This repository houses an enterprise-ready, full-stack e-commerce solution designed for operations-heavy commerce management. The system pairs a **modular monolith Express API** and **BullMQ worker process** with two dedicated React single-page applications: an **admin control panel** (94-screen operational, financial, and security console) and a **customer storefront web application** (50-screen discovery, checkout, and account portal). A minimal mobile integration helper layer is also included.

Business integrity is enforced at the backend level through route-level and action-level Role-Based Access Control (RBAC), append-only audit logging, idempotent payment processing, backend-driven business eligibility rules, and automated job queues.

---

## Features

- **Catalog & Merchandising**: Product management with variants, multi-media uploads, brands, nested categories, and review moderation.
- **Inventory & Multi-Warehouse**: Variant-level stock tracking across multiple warehouses with automated reservation on checkout and append-only movement logs.
- **Cart, Checkout & Order Processing**: Idempotent checkout sessions, normalized pricing snapshots, coupon application, and structured order state transitions.
- **Payments & Financial Control**: Provider integrations (Paystack), webhook-driven verification, partial/full refunds, and payment exception reconciliation queues.
- **Promotions & Campaigns**: Targeted coupon redemption, rule-based promotions, and marketing banner scheduling.
- **Post-Purchase & Service**: Support ticket management, pre-purchase inquiries, order returns, cancellations, and refund queues with SLA metrics.
- **Governance, Audit & Security**: System audit logs, admin action tracking, security incident handling, session anomaly detection, and RBAC permission enforcement.
- **Asynchronous Background Processing**: Queue-backed processing via Redis and BullMQ for notifications, webhooks, reconciliation tasks, and low-stock monitoring.
- **Observability**: Built-in health check probes (`/health`, `/ready`), Sentry error tracking, Pino structured logging, and performance monitoring.

---

## Tech Stack

| Layer | Technologies / Tools |
| :--- | :--- |
| **Backend API** | Node.js (v20+), Express.js (v5), TypeScript (v6), Zod, Pino, Helmet, Cors, Compression |
| **Database & ORM** | PostgreSQL (v16), Prisma ORM (v7) with `@prisma/adapter-pg` |
| **Cache & Queue** | Redis (v7), BullMQ (v5), ioredis |
| **Admin Frontend** | React 18, TypeScript, Vite, React Router 7, TanStack React Query v5, Zustand, React Hook Form, Tailwind CSS, Lucide React, Sentry React |
| **Customer Frontend** | React 18, TypeScript, Vite, React Router 6, TanStack React Query v5, Zustand, React Hook Form, Tailwind CSS, Vitest |
| **Authentication & AuthZ** | Clerk (`@clerk/express`, `@clerk/react`), Backend-enforced RBAC |
| **Third-Party Services** | Paystack (Payments), Brevo (Transactional Email), Cloudinary (Media Storage), Cloudflare Turnstile (Bot Challenge) |
| **DevOps & Infrastructure** | Docker, Docker Compose, Render (`render.yaml`), Netlify (`netlify.toml`), GitHub Actions |

---

## Architecture

The system is structured as a **modular monolith** backend accompanied by two decoupled React frontend applications.

```mermaid
graph TD
    CF[Customer Frontend - React/Vite] -->|HTTPS / REST API| API[Express API Server]
    AF[Admin Frontend - React/Vite] -->|HTTPS / REST API| API
    MF[Mobile Integration Helpers] -->|HTTPS / REST API| API

    API -->|Read/Write| PG[(PostgreSQL Database)]
    API -->|Session Cache / Rate Limits| REDIS[(Redis Store)]
    API -->|Enqueue Jobs| BULL[BullMQ Queues]

    WORKER[BullMQ Worker Process] -->|Consume Jobs| BULL
    WORKER -->|Read/Write| PG
    WORKER -->|Execute Operations| REDIS

    WORKER -->|Transactional Mail| BREVO[Brevo Email API/SMTP]
    API -->|Media Uploads| CLOUD[Cloudinary CDN]
    API -->|Payment Verification / Webhooks| PAYSTACK[Paystack Payment Gateway]
    API & WORKER -->|Error Tracking| SENTRY[Sentry Monitoring]
```

---

## Prerequisites

- **Node.js**: `>=20.19.0 <27`
- **npm**: `>=10.0.0`
- **PostgreSQL**: `>=16.0` (or running via Docker Compose)
- **Redis**: `>=7.0` (or running via Docker Compose)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/mrgranthox/multi-store-react-native.git
cd multi-store-react-native
```

### 2. Install workspace dependencies

Install dependencies in each application directory:

```bash
# Backend
cd backend && npm install && cd ..

# Admin Frontend
cd admin-frontend && npm install && cd ..

# Customer Frontend
cd customer-frontend && npm install && cd ..
```

### 3. Start local infrastructure (PostgreSQL & Redis)

You can run PostgreSQL and Redis locally using Docker Compose:

```bash
docker compose up -d postgres redis
```

### 4. Configure environment variables

Copy the example environment files in each directory:

```bash
cp backend/.env.example backend/.env
cp admin-frontend/.env.example admin-frontend/.env
cp customer-frontend/.env.example customer-frontend/.env
```

### 5. Generate Prisma client & apply database migrations

```bash
cd backend
npx prisma generate
npm run start:migrate:seed
cd ..
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable Name | Purpose | Required | Default / Sample |
| :--- | :--- | :--- | :--- |
| `PORT` | Express server port | No | `4000` |
| `NODE_ENV` | Application environment | Yes | `development` |
| `APP_BASE_URL` | Base API URL | Yes | `http://localhost:4000` |
| `ADMIN_APP_URL` | Admin SPA client URL | Yes | `http://localhost:5174` |
| `CUSTOMER_APP_URL` | Customer SPA client URL | Yes | `http://localhost:3001` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | Yes | `http://localhost:3000,http://localhost:3001,http://localhost:5174` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://ecommerce_user:strongpassword@localhost:5432/ecommerce_db` |
| `REDIS_URL` | Redis connection URL | Yes | `redis://localhost:6379` |
| `SESSION_SECRET` | Session secret key (min 32 chars) | Yes | `development-session-secret-min-32-chars!!` |
| `CLERK_PUBLISHABLE_KEY` | Clerk Auth publishable key | Yes (Prod) | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Auth secret key | Yes (Prod) | `sk_test_...` |
| `CLERK_WEBHOOK_SECRET` | Clerk Webhook signing secret | Optional | `whsec_...` |
| `PAYMENT_PROVIDER` | Active payment provider | No | `paystack` |
| `PAYSTACK_SECRET_KEY` | Paystack API secret key | Yes (Paystack) | `sk_test_...` |
| `PAYSTACK_PUBLIC_KEY` | Paystack API public key | Yes (Paystack) | `pk_test_...` |
| `EMAIL_PROVIDER` | Active email provider (`brevo` / `none`) | No | `brevo` |
| `BREVO_API_KEY` | Brevo API key for transactional emails | Yes (Brevo) | `xkeysib-...` |
| `STORAGE_PROVIDER` | Active storage provider (`cloudinary` / `none`) | No | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier | Yes (Cloudinary) | `cloud_name` |
| `SENTRY_DSN` | Sentry Error Reporting DSN | Optional | `https://...` |

### Admin Frontend (`admin-frontend/.env`)

| Variable Name | Purpose | Required | Default |
| :--- | :--- | :--- | :--- |
| `VITE_BACKEND_BASE_URL` | Express API base URL | Yes | `http://127.0.0.1:4000` |
| `VITE_DEV_PROXY_TARGET` | Development proxy target | No | `http://127.0.0.1:4000` |
| `VITE_SENTRY_DSN` | Sentry DSN for admin UI | Optional | `https://...` |

### Customer Frontend (`customer-frontend/.env`)

| Variable Name | Purpose | Required | Default |
| :--- | :--- | :--- | :--- |
| `VITE_BACKEND_BASE_URL` | Express API base URL | Yes | `https://api.yourdomain.com` |
| `VITE_DEV_PROXY_TARGET` | Local proxy target | No | `http://127.0.0.1:4000` |

---

## Usage

### Development Mode

Run the individual components in separate terminal instances:

```bash
# Start Backend API
cd backend && npm run dev

# Start Background Worker
cd backend && npm run worker:dev

# Start Admin Control Panel (http://localhost:5174)
cd admin-frontend && npm run dev

# Start Customer Storefront (http://localhost:3000 or port configured by Vite)
cd customer-frontend && npm run dev
```

### Production Build & Run

```bash
# Build Backend
cd backend && npm run build
npm run start:migrate

# Build Admin Frontend
cd admin-frontend && npm run build

# Build Customer Frontend
cd customer-frontend && npm run build
```

### Running with Docker Compose

To launch the full system (API, Worker, Postgres, Redis) in Docker containers:

```bash
docker compose up --build
```

---

## Project Structure

```
├── .github/workflows/          # CI/CD pipelines (backend-ci, frontend-ci, deploy, security)
├── admin-frontend/             # Admin Control Panel (React 18 + Vite SPA)
│   ├── src/                    # Components, pages (94 screens), hooks, API integration
│   ├── scripts/                # Stitch UI export & contract verification scripts
│   └── package.json
├── backend/                    # Core Modular Monolith Express API
│   ├── prisma/                 # Prisma schema & database migration scripts
│   ├── scripts/                # Enterprise readiness & verification scripts
│   ├── src/
│   │   ├── app/                # Express application setup, routes, & middleware
│   │   ├── bootstrap/          # Server and Worker startup entrypoints
│   │   ├── modules/            # Business modules (catalog, orders, payments, auth, etc.)
│   │   └── workers/            # BullMQ job processors & schedulers
│   └── package.json
├── customer-frontend/          # Customer Storefront Web App (React 18 + Vite SPA)
│   ├── src/                    # Storefront pages (50 screens), catalog, cart, checkout UI
│   └── package.json
├── deploy/                     # Deployment configurations (GCP scripts, Runbooks)
├── docs/                       # Architecture specifications, API contracts, & documentation
├── mobile-frontend/            # Minimal mobile-facing helper scripts
├── docker-compose.yml          # Local containerized infrastructure orchestration
├── render.yaml                 # Render platform deployment manifest
└── LICENSE                     # Software License (MIT)
```

---

## API Reference

The backend exposes a structured REST API grouped by module under the `/api` prefix. Key routes include:

| Route Prefix | Category | Key Operations |
| :--- | :--- | :--- |
| `GET /ready`, `GET /health` | Health Check | System readiness, database connection, and worker health status |
| `/api/auth/*` | Auth & Identity | Clerk session verification, admin step-up authentication, session state |
| `/api/admin/users/*` | Admin RBAC | Admin account management, role assignment, permissions enforcement |
| `/api/catalog/*` | Catalog | Public product listing, categories, brands, variants, search |
| `/api/cart/*` | Cart | Guest/authenticated cart creation, item management, coupon application |
| `/api/checkout/*` | Checkout | Idempotent checkout sessions, address validation, order previews |
| `/api/orders/*` | Orders | Customer order tracking, admin order queue, status transitions |
| `/api/payments/*` | Payments | Paystack payment initialization, webhook handlers, transaction verification |
| `/api/returns/*` | Post-Purchase | Return request submission, return inspection queue, refund trigger |
| `/api/support/*` | Customer Service | Support ticket creation, thread replies, SLA tracking queues |
| `/api/admin/audit/*` | Audit & Security | System audit trail exploration, admin mutation log review |

Full API route specifications and DTO contracts are documented in `docs/backend_route_catalog_2026-03-28.json` and `docs/admin_api_dto_contract.md`.

---

## Testing

### Backend Unit & Integration Tests

```bash
cd backend

# Run unit tests
npm run test:unit

# Run full integration test suite
npm run test:integration

# Run enterprise compliance & contract verifications
npm run verify:enterprise
```

### Admin Frontend Tests & Verifications

```bash
cd admin-frontend

# Run contract & quality verification scripts
npm run verify:enterprise

# Run end-to-end Playwright tests (requires Playwright setup)
npm run test:e2e
```

### Customer Frontend Unit Tests

```bash
cd customer-frontend

# Run Vitest test suite
npm run test
```

---

## Deployment

### Render Deployment

The repository includes a ready-to-use `render.yaml` manifest specifying two web/worker services:
1. **Backend Web Service**: Runs `npm run start:migrate` with a HTTP health probe at `/health`.
2. **Worker Background Service**: Runs `npm run worker` to execute asynchronous BullMQ jobs.

### Docker Deployment

Production Dockerfiles are present in `backend/Dockerfile`. You can build and deploy container images directly or use Docker Compose (`docker-compose.yml`).

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Open Questions

1. **Mobile Frontend**: The repository currently contains a minimal helper integration under `mobile-frontend/`. Full mobile UI screens (48-screen spec) can be implemented in React Native consuming the shared `/api` endpoints.
2. **Turnstile Captcha Settings**: In production environments, bot challenge enforcement on support/inquiry routes requires setting `ABUSE_CHALLENGE_PROVIDER=turnstile` alongside valid Cloudflare Turnstile keys in `backend/.env`.
