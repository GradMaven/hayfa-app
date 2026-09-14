# Security

Full detail: [`docs/security-architecture.md`](docs/security-architecture.md). This file is the summary + how to report an issue.

## Reporting a vulnerability

This is a demo/development-phase project with synthetic seed data only — there is no production deployment or bug bounty at this time. If you find a security issue while reviewing this codebase, open an issue describing it; avoid including exploit details in a public issue if the project is ever deployed against real data.

## The rules this codebase enforces

1. **Authentication is never sufficient for authorization.** Every request that touches a specific patient's data is checked against that patient's actual ownership/consent/caregiver relationship, re-derived from the database on every call (`canAccess()`, [`src/lib/consent/index.ts`](src/lib/consent/index.ts)) — never inferred from role or from a client-supplied ID alone.
2. **No secret reaches the client bundle.** Database URLs, the MFA-encryption secret, storage credentials, SMTP credentials, and the AI API key are read only in server-only modules (`src/lib/*`, route handlers) — never in a Client Component. Feature *flags* (`NEXT_PUBLIC_ENABLE_*`) are deliberately the one category of config exposed to the browser — they're on/off switches, not secrets, and several gate what a Client Component renders (see `docs/ai-architecture.md` "A bug this work surfaced and fixed").
3. **Passwords are bcrypt-hashed (cost 12), sessions are opaque tokens hashed at rest.** No JWT, no plaintext secret ever written to the database.
4. **Every write is Zod-validated server-side**, even though the same schema also validates client-side — the client check is UX, the server check is the actual boundary.
5. **Object-level authorization is checked per request**, not cached in a session claim — a revoked consent takes effect on the very next request.
6. **Admin roles do not bypass patient-data authorization.** No route in this codebase grants elevated roles a shortcut past `canAccess()`.
7. **Emergency access is scoped, logged, and never silent** — see [`docs/security-architecture.md`](docs/security-architecture.md) "Emergency access is not a backdoor."
8. **MFA never leaves a half-open session.** A password-correct, MFA-enabled sign-in gets a short-lived challenge cookie, not a session — no `Session` row exists until the second factor is verified. The TOTP secret is encrypted at rest (AES-256-GCM, keyed from `AUTH_SECRET`), not just stored. See [`docs/security-architecture.md`](docs/security-architecture.md) "Multi-factor authentication."

## Known gaps (tracked, not hidden)

Malware scanning on document upload is not wired; audit-log append-only-ness is enforced at the application layer only (no DB trigger yet); no automated security test suite (IDOR/XSS/CSRF/rate-limit-bypass) has been run. Full list: [`docs/security-architecture.md`](docs/security-architecture.md) "What's deliberately deferred."
