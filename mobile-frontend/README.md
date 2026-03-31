# Mobile Frontend Integration Scaffold

This workspace did not contain a mobile app yet. The files under `src/integrations/` are minimal mobile-facing helpers for:
- fetching runtime config from `GET /api/client-config/mobile`
- forwarding Turnstile `captchaToken` values to support and product-inquiry endpoints

The mobile app should fetch runtime config on boot and use the returned `abuseChallenge` settings to decide whether to render a challenge step before submit.
