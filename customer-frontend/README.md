# Customer Frontend Integration Scaffold

This workspace did not contain a customer app yet. The files under `src/integrations/` are minimal backend-facing helpers for:
- fetching runtime config from `GET /api/client-config/customer`
- submitting public support contact payloads with `captchaToken`
- submitting product inquiries with `captchaToken`

The backend now exposes Turnstile configuration and support endpoints dynamically, so the customer UI can render the challenge only when the backend says it is enabled.
