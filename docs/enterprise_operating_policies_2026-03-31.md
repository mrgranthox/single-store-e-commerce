# Enterprise Operating Policies

## Security

- `ALLOW_DEV_AUTH_BYPASS` is only valid in `development` loopback traffic or `test`.
- Sensitive admin mutations require a fresh `x-admin-step-up-token`.
- Secret scanning and dependency review are mandatory CI checks.

## Reliability

- All operational queue families use exponential backoff and five attempts by default.
- Manual replay is only allowed from failed states.
- Every replay action must create an audit log and an admin action log.

## Privacy And Compliance

- Request logs store actor and IP fingerprints only, never raw identifiers.
- Logger redaction must cover secrets, auth material, email, phone, and address payloads.
- Customer privacy endpoints must support export and anonymize actions with audit trails.

## Release Engineering

- Latest migration is checked for destructive SQL before deployment.
- Deploys must run post-deploy health verification and rollback automatically on failure when enabled.
- Rollout strategy is declared at workflow dispatch even when the current release executes as a direct rollout.

## Observability

- Every HTTP response emits `x-request-id` and `x-trace-id`.
- Synthetic checks must validate `/health`, `/ready`, and critical authenticated flows when tokens are available.

## Alert Ownership Matrix

| Severity | Primary owner | Escalation | Expected response |
| --- | --- | --- | --- |
| `CRITICAL` | Platform on-call | Engineering lead + incident commander | 15 minutes |
| `HIGH` | Domain owner | Platform on-call | 30 minutes |
| `MEDIUM` | Domain owner | Next business-hour ops review | 4 hours |
| `LOW` | Domain backlog owner | Weekly triage | 2 business days |
| `INFO` | Feature owner | None | Best effort |
