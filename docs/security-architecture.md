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
- Sign-in and sign-up are rate-limited per IP+email ([`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) — in-memory, documented as not multi-instance-safe; a shared store is a deploy-time swap, not a code change).
- Sign-in failure messages are deliberately generic ("Incorrect email or password") — never confirm whether an email is registered. Password-reset requests behave identically whether or not the account exists.

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

## Secrets

No secret (`DATABASE_URL`, `AUTH_SECRET`, `STORAGE_SECRET_ACCESS_KEY`, `AI_API_KEY`) is referenced from any file under `src/app/**/page.tsx` or any Client Component — they are read only in `src/lib/*` server-only modules and route handlers. `.env` is git-ignored; `.env.example` documents every variable without values. See [ENVIRONMENT.md](../ENVIRONMENT.md).

## What's deliberately deferred

- MFA: `User.mfaEnabled`/`mfaSecret` exist in the schema; the enrollment/verification flow is not built. TOTP is the intended mechanism.
- Malware/virus scanning on upload (§18 pipeline step "Virus/security scan") is not wired — documented gap, not a silent omission. A `StorageProvider.put()` call is the natural integration point.
- A DB-level trigger enforcing AuditEvent/DataAccessLog append-only-ness (currently enforced only at the application layer via `src/lib/audit/`) — recommended before production.
- Formal penetration testing / the security-test checklist in §71 (auth bypass, IDOR, privilege escalation, XSS, CSRF, rate-limit bypass) has been reasoned through in design, not run as an automated suite yet.
