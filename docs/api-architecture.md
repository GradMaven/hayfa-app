# API Architecture

## Versioning & envelope (§46)

Every endpoint lives under `/api/v1/*`. Success and error responses share one shape ([`src/lib/api-response.ts`](../src/lib/api-response.ts)):

```json
{ "success": true, "data": { }, "meta": { } }
{ "success": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

`withApiErrors()` wraps every route handler body so a thrown `ApiException` or `ZodError` becomes the right envelope automatically, and anything unexpected becomes an opaque `INTERNAL_ERROR` — the real error is `console.error`'d server-side (message only, never the full object or a stack trace) and never reaches the client. Error codes map to HTTP status via a fixed table (`UNAUTHENTICATED→401`, `FORBIDDEN→403`, `NOT_FOUND→404`, `VALIDATION_ERROR→422`, `CONFLICT→409`, `RATE_LIMITED→429`, `INTERNAL_ERROR→500`).

## Route inventory

| Prefix | Resources |
|---|---|
| `/api/v1/auth` | signup, signin, signout, session, sessions (list/revoke), request-password-reset, reset-password |
| `/api/v1/patients/me` | profile create/read/update, emergency-access toggle |
| `/api/v1/account/phone` | set/clear the account's phone number (used for SMS notifications) |
| `/api/v1/{medications,conditions,labs,vitals,allergies,immunizations,appointments,care-plans}` | list/create, `[id]` update/soft-delete |
| `/api/v1/corrections` | patient-owned: dispute a provider-verified/non-patient-sourced medication, condition, or lab result (list/create; see security-architecture.md) |
| `/api/v1/timeline` | filtered, scope-aware, cursor-paginated health events |
| `/api/v1/documents` | upload, list, `[id]` read/delete, `[id]/download` (signed URL), `[id]/ocr`, `[id]/ocr/confirm` |
| `/api/v1/consents` | patient-owned grant list/create, `[id]/revoke` |
| `/api/v1/caregivers` | patient-owned link list/create, `[id]` revoke |
| `/api/v1/emergency-access` | provider-initiated, policy-authorized |
| `/api/v1/audit` | patient's own access-history log |
| `/api/v1/export` | full structured record, JSON |
| `/api/v1/ai/*` | timeline-summary, explain-lab, summarize-document, prepare-visit |
| `/api/v1/dashboard/summary` | one aggregate call for the Home dashboard |
| `/api/v1/notifications` | list, mark-read |
| `/api/v1/portal/overview` | provider/caregiver "who's granted you access" (see below) |
| `/portal/patients/[patientId]` (page, not `/api/v1`) | provider-only chart view — see [provider-portal-architecture.md](provider-portal-architecture.md); re-derives its own auth from an active `Consent` rather than a dedicated API route |
| `/api/v1/auth/provider-signup` | self-serve provider registration (always `PENDING`) |
| `/api/v1/admin/providers` | `SUPER_ADMIN`-only provider verification queue — see [admin-architecture.md](admin-architecture.md) |

Every one of these (aside from `/auth/*` and the two password-reset routes) sits behind `requireUser()` at minimum, and every patient-scoped one behind `canAccess()` — see [security-architecture.md](security-architecture.md) — **except** `/consents`, `/caregivers`, and `/corrections`, which are direct ownership checks (`actor.patientProfileId === patientId`) rather than `canAccess()`, since granting access or disputing your own record is an owner-only action, not something being "accessed." `/admin/providers` is a different case again: it's not patient-scoped at all (it administers `HealthcareProvider`/`User` account records), so `requireRole("SUPER_ADMIN")` alone is the correct check — see [admin-architecture.md](admin-architecture.md).

## Why `/api/v1/portal/overview` exists

The brief's organization/admin dashboards (§60, §63) are out of this phase's scope (see [discovery-report.md](discovery-report.md)), but a provider or caregiver still needs to sign in to *something* real. This one small endpoint returns the patients who've granted that actor consent/caregiver access — real data already in the schema, honestly scoped, not a stub. For providers, each row links into `/portal/patients/[patientId]`, a full chart view with clinical-workflow write actions — see [provider-portal-architecture.md](provider-portal-architecture.md). Caregivers still get only this list, not a record browser.

## Request validation

Every write handler parses `request.json()` (or `request.formData()` for uploads) through a Zod schema from [`src/lib/validation/`](../src/lib/validation/) before touching Prisma. The same schemas are imported client-side for `react-hook-form` + `@hookform/resolvers/zod`, so the form's own validation and the server's are provably the same rules, not two hand-written copies that can drift.

## Pagination

List endpoints likely to grow unbounded (`/timeline`, `/audit`) use cursor pagination (`?cursor=<id>&limit=<n>`, response `meta.nextCursor`) rather than offset — stable under concurrent writes and doesn't require counting the full table. Smaller, bounded lists (medications, conditions, etc. — realistically dozens of rows per patient, not thousands) return the full set; §70's "never load thousands of health events into the browser at once" is specifically why `/timeline` is the one list page built with pagination from day one.

## What's deferred

- OpenAPI/Swagger generation (§47) — the route inventory above is the documentation for now; a generated spec from the Zod schemas is a natural next step (`zod-to-openapi` or similar).
- The developer/partner API surface (§48) and webhooks (§49) — no external caller exists yet to design a stable public contract for.
- Formal API rate limiting beyond auth endpoints — `src/lib/rate-limit.ts` is applied to `/auth/signin`, `/auth/signup`, `/auth/request-password-reset` only; broader API rate limiting is a production-hardening task.
