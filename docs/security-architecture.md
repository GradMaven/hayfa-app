# Security Architecture

## Defense in depth (§90)

```
Authentication (session cookie → opaque token → Session row)
        ↓
Role authorization (requireRole() — coarse: can this role ever call this?)
        ↓
Object-level authorization (canAccess() — does THIS actor have rights to THIS patient?)
        ↓
Zod validation (is the request body well-formed?)
        ↓
Domain logic
        ↓
Audit event (DataAccessLog for clinical data, AuditEvent for everything else)
        ↓
Response
```

No layer trusts the one above it. In particular, **role authorization is never sufficient on its own** — see "Object-level authorization" below. This is implemented once, centrally, in [`src/lib/api/patient-scope.ts`](../src/lib/api/patient-scope.ts) and [`src/lib/consent/index.ts`](../src/lib/consent/index.ts), and every `/api/v1/*` route that touches patient data calls through it rather than re-implementing checks.

## Authentication

Custom, not a third-party auth library — see [discovery-report.md](discovery-report.md) for why NextAuth/Auth.js was rejected for this phase (beta-stage Credentials+DB-session interaction).

- Passwords: bcrypt, cost factor 12 ([`src/lib/auth/password.ts`](../src/lib/auth/password.ts)). Never stored or logged in plaintext.
- Sessions: opaque 256-bit random tokens (`crypto.randomBytes`), SHA-256 hashed before storage ([`src/lib/auth/tokens.ts`](../src/lib/auth/tokens.ts), [`session.ts`](../src/lib/auth/session.ts)). The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production. A stolen database row cannot be replayed as a session token — only the hash is stored.
- Revocation is immediate and real: `Session.revokedAt` is checked on every request. Password reset revokes every other session for that user. The Settings page (§13/§42) lets a user see and end individual sessions.
- Password reset tokens and email-verification tokens follow the identical opaque-token-hashed-at-rest pattern, single-use (`usedAt`), short-lived.
- Email verification follows the identical opaque-token-hashed-at-rest, single-use, expiring pattern (`EmailVerificationToken`, 24h TTL). It is **not access-gating** — an unverified account can use the app fully (a persistent, non-blocking banner nudges verification) — so `POST /verify-email/confirm` is deliberately public (token-only, no session required), the same reasoning as password-reset confirm: the link may be opened on a different device than the one signed in. Requesting a new link (`POST /verify-email/resend`, rate-limited per user) deletes any still-unused prior token first, so only the newest link ever works — verified live: an old link fails after a resend, the new one succeeds, and re-using a consumed token fails.
- Password reset emails are sent through a real `EmailProvider` ([`src/lib/email/index.ts`](../src/lib/email/index.ts) — console in dev, SMTP against any real vendor otherwise; see [ENVIRONMENT.md](../ENVIRONMENT.md)). Completing a reset also sends a **confirmation** to the account's email (not the requester) — if a reset was attacker-initiated, the real owner finds out even though every other session was already revoked. A send failure never changes the endpoint's response or blocks the reset (logged server-side only) — surfacing it would create a timing/error oracle for account enumeration.
- Sign-in and sign-up are rate-limited per IP+email ([`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) — in-memory, documented as not multi-instance-safe; a shared store is a deploy-time swap, not a code change).
- Sign-in failure messages are deliberately generic ("Incorrect email or password") — never confirm whether an email is registered. Password-reset requests behave identically whether or not the account exists.

## Multi-factor authentication (§13)

TOTP-based (RFC 6238), compatible with any standard authenticator app — no proprietary push mechanism. See [`src/lib/auth/mfa.ts`](../src/lib/auth/mfa.ts), [`mfa-crypto.ts`](../src/lib/auth/mfa-crypto.ts), [`mfa-challenge.ts`](../src/lib/auth/mfa-challenge.ts), and the routes under [`src/app/api/v1/auth/mfa/`](../src/app/api/v1/auth/mfa/).

- **MFA challenge, not a half-open session.** A password-correct, MFA-enabled sign-in creates an `MfaChallenge` row and a *separate* short-lived cookie (`hafya_mfa_challenge`) — never a `Session` row, never the session cookie. No route that checks for the session cookie can be tricked into treating a pending MFA login as authenticated, because the artifact simply doesn't exist yet. The challenge is single-use (deleted on success), expires in 5 minutes, and locks after 5 failed attempts — enforced server-side (`MfaChallenge.attempts`), not just via the general IP rate limiter.
- **The TOTP secret is encrypted at rest**, not just hashed — unlike a password, the server must be able to read it back to compute the expected code. AES-256-GCM, keyed from `AUTH_SECRET` ([`mfa-crypto.ts`](../src/lib/auth/mfa-crypto.ts)); a stolen database dump alone doesn't yield usable authenticator secrets without also having `AUTH_SECRET`, which is deploy-environment configuration, not application data.
- **Enrollment requires proof of possession.** `POST /enroll/start` generates and stores a secret but leaves `mfaEnabled: false`; only `POST /enroll/confirm`, which requires a valid code generated from that secret, flips it on. An abandoned enrollment just leaves an inert, disabled secret.
- **Backup codes** (10, single-use, SHA-256-hashed at rest — same pattern as sessions) are generated once at enrollment and shown exactly once. Consuming one is an atomic conditional update (`updateMany` with `usedAt: null` in the `WHERE`), not a read-then-write, so two concurrent requests can't both succeed with the same code.
- **Disabling MFA requires both factors again** — current password *and* a current code (TOTP or backup) — not just an authenticated session, and revokes every other active session as a side effect (same hygiene as a password reset).
- Verified end-to-end against a running instance: enrollment, correct/incorrect TOTP, backup-code login, backup-code single-use, attempt-lockout, and disable all behave as specified above (not merely typechecked).

## Object-level authorization (IDOR prevention, §43)

`GET /api/v1/labs/:id` does not return a result because the requester is authenticated — it returns a result because `canAccess()` re-derived, from the database, that this actor is either the record's owner, a caregiver with the right scope, or a provider holding an active consent naming that scope. This check happens on **every** request, not once at login, so a revoked consent or removed caregiver link takes effect immediately.

Every route handler that accepts a resource `:id` first loads the record to discover its `patientId`, then calls `authorizePatientAccess()` — it never trusts a `patientId` supplied by the client for anything other than the initial lookup.

## RBAC (§42)

`User.role` (`PATIENT`, `CAREGIVER`, `PROVIDER`, `PROVIDER_ADMIN`, `ORG_ADMIN`, `INTEGRATION_ADMIN`, `PLATFORM_SUPPORT`, `SUPER_ADMIN`) gates which endpoints a role can call at all (`requireRole()`). It is intentionally coarse — the actual "can you see *this* patient's *this* data" decision is always the object-level check above, never inferred from role alone. Administrative roles are **not** wired to bypass `canAccess()` anywhere in this codebase — see "Administrative privilege ≠ clinical-data privilege" below.

## Administrative privilege ≠ clinical-data privilege (§6, §105)

No route in this phase grants an admin role implicit access to patient clinical data. The admin surface (user management, provider verification, platform config) is out of MVP scope (see [discovery-report.md](discovery-report.md)); when it's built, it must call `canAccess()` like every other actor, or go through a separately-audited support-access flow — never a silent bypass.

## Emergency access is not a backdoor (§29)

`POST /api/v1/emergency-access` is deliberately **not** routed through `canAccess()`/`Consent`. It requires: a `PROVIDER` role, `providerVerified === true`, the target patient's `emergencyAccessEnabled === true`, and a stated reason. It returns a fixed, minimal dataset (blood type, allergies, active medications, emergency contact) — never the full record — and every call, allowed or denied, writes an `AuditEvent`. See [`src/app/api/v1/emergency-access/route.ts`](../src/app/api/v1/emergency-access/route.ts).

## Input validation & injection

- Every write endpoint parses its body through a Zod schema ([`src/lib/validation/`](../src/lib/validation/)) before it reaches Prisma — no raw request data reaches a query.
- All database access goes through Prisma's parameterized query builder; there is no raw SQL string concatenation anywhere in the codebase.
- File uploads are restricted by MIME type and size ([`src/lib/validation/documents.ts`](../src/lib/validation/documents.ts)); storage keys are derived server-side from a generated document ID, not from user-supplied paths (`buildDocumentStorageKey` sanitizes the filename component).

## Malware scanning on upload (§18)

Every uploaded file is scanned by a real ClamAV daemon *before* anything is persisted — before the `Document` row is created and before the bytes ever reach object storage ([`src/app/api/v1/documents/route.ts`](../src/app/api/v1/documents/route.ts), [`src/lib/malware-scan/index.ts`](../src/lib/malware-scan/index.ts)). An infected file is rejected outright: no row, no stored object, just an `AuditEvent` (`DOCUMENT_UPLOAD_REJECTED_MALWARE`, carrying the filename/size/threat name — never the file content) and a plain error to the uploader.

- **Fails closed, not open.** If the scanner can't be reached (daemon down, network issue, unexpected reply), the upload is rejected with a "try again shortly" message — it is never treated as clean by default. This is a deliberate asymmetry from every other provider in this codebase (Storage/Email/AI all have a safe mock fallback) — an unreachable AV daemon must never look the same as a clean file. Verified live: pointing `CLAMAV_PORT` at an unreachable port produced the correct rejection with no document created, in the same run that confirmed clean files and infected files behave correctly against the real daemon.
- **Explicit opt-out only.** `MALWARE_SCAN_PROVIDER=none` is a distinct, visible operator choice (e.g. for a CI environment without ClamAV) — the resulting document is honestly marked `SKIPPED`, never `CLEAN`. There is no code path that silently disables scanning.
- **The wire protocol is implemented directly**, not through the `clamdjs` npm package this started with — that package returned an empty reply against a real clamd daemon in live testing (confirmed with both a clean buffer and the industry-standard EICAR test string), which would have made this module misread every clean file as infected. A raw-socket test against the same daemon confirmed the protocol itself (`zINSTREAM`, length-prefixed chunks, a zero-length terminator — documented at `man 8 clamd`) is simple and correctly implementable directly; doing so trades an unmaintained ~16KB dependency for code this module owns and tests itself. This is the same judgment already applied to session auth (custom over NextAuth's beta rough edges) and OCR/AI (interfaces over premature vendor lock-in) — verify before trusting, especially for a security-critical path.
- **Verified against real detection, not a mock.** Local dev runs a real ClamAV daemon (`docker compose up -d`, see [ENVIRONMENT.md](../ENVIRONMENT.md)) with live virus definitions. This was tested end-to-end through the actual upload API with the EICAR test file (the universal, harmless-but-detected string every AV engine recognizes specifically for this purpose) — rejected with the correct error, no document created, no object stored, audit event logged with the real detected signature name (`Eicar-Test-Signature`). A genuinely clean file in the same run uploaded successfully and was marked `CLEAN`.

## Secrets

No secret (`DATABASE_URL`, `AUTH_SECRET`, `STORAGE_SECRET_ACCESS_KEY`, `AI_API_KEY`) is referenced from any file under `src/app/**/page.tsx` or any Client Component — they are read only in `src/lib/*` server-only modules and route handlers. `.env` is git-ignored; `.env.example` documents every variable without values. `AUTH_SECRET` is now load-bearing (MFA-secret encryption key) — see [ENVIRONMENT.md](../ENVIRONMENT.md).

## What's deliberately deferred

- A DB-level trigger enforcing AuditEvent/DataAccessLog append-only-ness (currently enforced only at the application layer via `src/lib/audit/`) — recommended before production.
- Formal penetration testing / the security-test checklist in §71 (auth bypass, IDOR, privilege escalation, XSS, CSRF, rate-limit bypass) has been reasoned through in design, not run as an automated suite yet.
