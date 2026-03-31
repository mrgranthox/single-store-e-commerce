# Backend Frontend Integration Prep

Date: 2026-03-28

## Backend runtime config endpoints
- `GET /api/client-config/customer`
- `GET /api/client-config/mobile`
- `GET /api/client-config/admin`

## What they expose
- backend base paths
- Clerk publishable key when configured
- bearer token header conventions
- payment provider/channel basics
- storage/upload constraints
- customer/mobile Turnstile challenge contract
- admin report and media-upload endpoint paths

## Turnstile production submission path
- customer and mobile clients should:
  1. fetch runtime config from the backend
  2. inspect `routes.support.abuseChallenge`
  3. if `enabled=true`, render the provider challenge
  4. submit the provider token in `captchaToken`
- current protected submit targets:
  - `POST /api/support/contact`
  - `POST /api/products/:productSlug/questions`

## Admin frontend prep
- An admin frontend can fetch runtime config from `GET /api/client-config/admin`
- Upload-intent paths are exposed for:
  - catalog media
  - content media
- A route-catalog export script now exists:
  - `cd backend && npm run export:route-catalog`
