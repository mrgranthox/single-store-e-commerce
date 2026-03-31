# Enterprise Readiness Tracker

## Scope

- Backend hardening, admin frontend quality, CI/CD safety, compliance controls, observability, and release operations.
- Delivery model: incremental hardening on the existing architecture only.

## Phase Gates

| Phase | Goal | Exit gate |
| --- | --- | --- |
| 0 | Program controls | `verify:enterprise` exists in backend and admin frontend, tracker and policy docs committed |
| 1 | Security | Dev bypass blocked outside local/test, step-up enforced on sensitive admin mutations, CI secret/dependency gates active |
| 2 | Reliability | Retry replay guardrails enforced, queue contracts documented, replay actions audited |
| 3 | Compliance | PII-safe request logging, expanded logger redaction, customer privacy export/anonymize flows available |
| 4 | Release | Migration safety guard, staged deploy profile inputs, automated rollback path documented |
| 5 | Observability | Trace/request ids exposed, synthetic checks scheduled, alert ownership matrix documented |
| 6 | Frontend quality | Playwright, accessibility, and performance merge gates added to admin frontend CI |

## Risk Register

| Risk | Current control | Residual action |
| --- | --- | --- |
| Dev auth bypass misuse | Runtime/IP gating plus startup validation | Keep disabled in production and monitor warnings |
| Sensitive admin mutations without re-auth | One-time step-up token enforced on settings and session revocation | Expand to more high-risk admin mutations over time |
| Replay of safe/successful jobs | Failed-state replay guard | Continue widening replay metadata coverage in all queue producers |
| PII in logs | Fingerprinted request logging and logger redaction | Extend redaction policy when new payload shapes are introduced |
| Destructive migration rollout | CI migration safety gate | Require explicit approval for destructive SQL |
| Post-deploy regressions | Health-gated deploy with rollback hook | Maintain synthetic admin/customer tokens |

## Go / No-Go

- Go only when backend `verify:enterprise`, backend typecheck, backend unit tests, and admin frontend `verify:enterprise` pass.
- No-go on any secret scan failure, migration safety failure, replay audit regression, or missing runbook coverage.

## Required Runbooks

- `deploy/RUNBOOK.md`
- `docs/backend_operational_runbook_2026-03-28.md`
- `docs/enterprise_operating_policies_2026-03-31.md`
