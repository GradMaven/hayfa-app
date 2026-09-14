# Privacy Architecture

This is the technical counterpart to the legal/policy documents under [`docs/privacy/`](privacy/) — this file describes what the system *does*; those describe what it's *for* and what still needs qualified legal review. Neither substitutes for the other, and neither claims legal compliance on its own (§77).

## Data ownership in the product

The patient is the root of authorization for their own record (§26). Concretely:

- Every clinical table has a `patientId` foreign key; there is no clinical query path that doesn't filter by it.
- Only the patient can create/list/revoke `Consent` grants and `CaregiverLink`s for their own record (`src/app/api/v1/consents/route.ts`, `caregivers/route.ts` — checked against `actor.patientProfileId`, not delegated to `canAccess()`, since granting access is an owner-only action distinct from consuming one).
- The Privacy Center (`/privacy`) surfaces exactly the four things §26 asks for: what's stored (via export), who can access it (consents list on `/sharing`), when it was accessed (access log), and what's active vs. expired (`Consent.status`).

## The Privacy Center (§54)

| §54 section | Implementation |
|---|---|
| View / export data | `GET /api/v1/export` → `/privacy` "Export my record" |
| Active / expired / revoked permissions | `/sharing` (provider access tab) reads `Consent.status`, auto-expiring stale grants on read (`expireStaleConsents`) |
| Who accessed your records, when, why | `GET /api/v1/audit` → `/privacy` access history, backed by `DataAccessLog` |
| AI privacy | `/privacy` "AI privacy" card — states plainly whether AI is enabled and what happens to data when it is |
| Connected services | Not built — no real integrations are wired yet (see [integration-architecture.md](integration-architecture.md)); nothing to disclose until one exists |

## Granular sharing, not a toggle (§28)

`Consent.dataScopes` is a string array drawn from a fixed vocabulary (`MEDICATIONS`, `ALLERGIES`, `APPOINTMENTS`, `LAB_RESULTS`, `CONDITIONS`, `DOCUMENTS`, `VITALS`, `IMMUNIZATIONS`, `CARE_PLANS`, `MENTAL_HEALTH`, `INSURANCE` — [`src/lib/consent/index.ts`](../src/lib/consent/index.ts)). The grant form (`/sharing`) requires at least one scope and an explicit duration (one-time / 24h / 7d / 30d / until revoked) — there is no "share everything" control anywhere in the product.

## Data minimization in AI calls (§50)

AI route handlers (`src/app/api/v1/ai/*`) select only the fields a feature needs before calling the provider — e.g. `timeline-summary` pulls `{id, type, title}` from `HealthEvent`, never the underlying clinical record. See [ai-architecture.md](ai-architecture.md).

## Logging hygiene (§64, §91)

- `src/lib/db.ts` explicitly excludes Prisma's `"query"` log level — SQL parameters (which can contain patient names, results, notes) are never written to stdout/stderr.
- `src/lib/api-response.ts`'s catch-all logs only `err.message`, never the full error object or request body, and never returns a stack trace to the client.
- Nothing in the codebase does `console.log(patientRecord)` or equivalent — grep for `console.log` in `src/lib` and `src/app/api` to re-verify this holds as the codebase grows.

## Data never in URLs

No route places patient-identifying or clinical data in a query string beyond an opaque `patientId`/resource `id` (already an internal cuid, not a name or diagnosis). Search terms on `/timeline` are the one user-typed string that reaches a URL param client-side — this is client-only state, not sent anywhere but this app's own API.

## What's deferred

- Data correction workflow (§56 — a request/reason/corrected-representation flow distinct from a plain edit) is not built; edits today are direct (with `updatedAt` bumped) rather than versioned. This is the clearest gap against the full spec and the first thing to build if this goes further.
- Formal DPIA content — see [`docs/privacy/dpia.md`](privacy/dpia.md) for the template and what's filled in vs. flagged for legal review.
