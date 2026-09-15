# API

Full route inventory and conventions: [`docs/api-architecture.md`](docs/api-architecture.md). This file is the quick-reference.

## Envelope

```jsonc
// success
{ "success": true, "data": { /* ... */ }, "meta": {} }
// error
{ "success": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

Codes: `UNAUTHENTICATED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `VALIDATION_ERROR` (422) · `CONFLICT` (409) · `RATE_LIMITED` (429) · `INTERNAL_ERROR` (500).

## Auth

Cookie-based (`HttpOnly`, `SameSite=Lax`). Sign in via `POST /api/v1/auth/signin`, then every subsequent request from a browser carries the session cookie automatically. There is no bearer-token/API-key auth for external callers yet — see [`docs/api-architecture.md`](docs/api-architecture.md) "What's deferred" for the developer-API plan.

## Most-used routes

```
POST   /api/v1/auth/signup | signin | signout
GET    /api/v1/auth/session
POST   /api/v1/auth/mfa/verify                          (completes an MFA-pending sign-in)
POST   /api/v1/auth/mfa/enroll/start | enroll/confirm
GET    /api/v1/auth/mfa/status
POST   /api/v1/auth/mfa/disable | backup-codes/regenerate
POST   /api/v1/auth/verify-email/resend                 (authenticated — request a new link)
POST   /api/v1/auth/verify-email/confirm                 (public — token proves mailbox access)
GET    /api/v1/patients/me
POST   /api/v1/patients/me                 (create profile)
PATCH  /api/v1/patients/me                 (update profile)
PATCH  /api/v1/account/phone               (set or clear the account's phone number — used for SMS notifications)

GET    /api/v1/{medications,conditions,labs,vitals,allergies,immunizations,appointments,care-plans}?patientId=
POST   /api/v1/{same}                      (create)
PATCH  /api/v1/{same}/:id                  (update — not on vitals/immunizations, see docs/api-architecture.md;
                                             rejected with 409 on medications/conditions/labs once the record is
                                             provider-verified or not patient-sourced — see corrections below)
DELETE /api/v1/{same}/:id                  (soft delete)

POST   /api/v1/corrections                 (dispute a provider-verified/non-patient-sourced medication,
                                             condition, or lab result — patient-owned action, preserves the
                                             original value, applies immediately)
GET    /api/v1/corrections?resourceType=&resourceId= (correction history for one record; ?patientId= for all)

GET    /api/v1/timeline?type=&search=&from=&to=&cursor=&limit=
GET    /api/v1/dashboard/summary?patientId=

POST   /api/v1/documents                   (multipart upload — malware-scanned before anything is stored;
                                             rejected files never get a Document row)
GET    /api/v1/documents?patientId=
GET    /api/v1/documents/:id/download      (short-lived signed URL)
POST   /api/v1/documents/:id/ocr           (mock extraction, draft only)
POST   /api/v1/documents/:id/ocr/confirm   (the only path that writes a structured record from OCR)

GET    /api/v1/consents?patientId=
POST   /api/v1/consents                    (grant — patient-owned action)
POST   /api/v1/consents/:id/revoke

GET    /api/v1/audit?patientId=            (access history)
GET    /api/v1/export?patientId=           (full record, JSON)

GET    /api/v1/portal/overview             (provider/caregiver: patients who've granted access)
GET    /portal/patients/:patientId         (page, not an API route — provider chart view, scoped to
                                             consent.dataScopes; see docs/provider-portal-architecture.md)

POST   /api/v1/auth/provider-signup        (self-serve provider registration — always creates PENDING)
GET    /api/v1/organizations               (public — verified organizations only, for the signup picker)
GET    /api/v1/admin/providers?status=     (SUPER_ADMIN only; default status=PENDING)
POST   /api/v1/admin/providers/:id/verify  (SUPER_ADMIN only)
POST   /api/v1/admin/providers/:id/reject  (SUPER_ADMIN only — { reason } required)
PATCH  /api/v1/admin/providers/:id/organization  (SUPER_ADMIN only — assign/clear organization)
GET    /api/v1/admin/organizations         (SUPER_ADMIN only — all organizations, incl. unverified)
POST   /api/v1/admin/organizations         (SUPER_ADMIN only — create)
PATCH  /api/v1/admin/organizations/:id     (SUPER_ADMIN only — update fields, toggle verified)
DELETE /api/v1/admin/organizations/:id     (SUPER_ADMIN only — soft delete)
GET    /api/v1/admin/users?role=&status=&search=  (SUPER_ADMIN only — account list, no passwordHash,
                                                    nothing patient-scoped)
PATCH  /api/v1/admin/users/:id/status      (SUPER_ADMIN only — { status, reason? }; can't target self)
```

Every route accepting `?patientId=` defaults to the caller's own patient profile when omitted — a patient's own client code never has to know or pass its own ID.

## Adding a new patient-scoped route

Follow the pattern in any existing resource (e.g. [`src/app/api/v1/medications/route.ts`](src/app/api/v1/medications/route.ts)):

```ts
const actor = await requireUser();
const patientId = resolvePatientId(actor, body.patientId);
await authorizePatientAccess(request, { patientId, scope: "MEDICATIONS", action: "CREATE", resourceType: "Medication" });
const input = mySchema.parse(body);
// ...Prisma write...
await recordHealthEvent({ ... }); // if it belongs on the timeline
```

Skipping `authorizePatientAccess` is the one mistake that turns a route into an IDOR vulnerability — see [`SECURITY.md`](SECURITY.md).
