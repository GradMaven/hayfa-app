# Access Control

Companion to [security-architecture.md](../security-architecture.md)'s "defense in depth" — this document is the privacy-program-facing summary of the same mechanism: who can see what, and how that's enforced and evidenced.

## The rule

No actor other than the patient themself has default access to any patient's data. Every non-owner access — caregiver, provider, emergency — requires an explicit, discoverable grant that the patient can see and revoke (caregiver/provider) or a logged policy exception (emergency). This is enforced by `canAccess()` re-querying the database on every request, not by a role flag set at login — see [database-architecture.md](../database-architecture.md) and [security-architecture.md](../security-architecture.md) for the implementation.

## Access matrix

| Actor | Own data | Other patient's data |
|---|---|---|
| Patient | Full | None, ever |
| Caregiver | N/A (no clinical record of their own in this role) | Only scopes in an `ACTIVE` `CaregiverLink` for that specific patient |
| Provider | N/A | Only scopes in an `ACTIVE`, unexpired `Consent` naming that provider |
| Provider (emergency) | N/A | Fixed minimal dataset, only if patient enabled it, only with a verified provider account and a stated reason, time-limited (1 hour), fully logged |
| Admin roles | N/A | **None** in this phase — no route grants admin roles bypass of `canAccess()`; see §6/§105 "administrative privilege ≠ clinical-data privilege" |

## Evidence trail

Every access decision — allowed or denied — produces a `DataAccessLog` row (patient-visible, in `/privacy`) or an `AuditEvent` row (platform-level, e.g. sign-ins, consent grants/revocations, profile changes). A patient asking "who has seen my records and when" gets a real, complete answer from data the system already writes on every request, not a report generated after the fact from incomplete logs.

## Session-level access control

Independent of the data-layer checks above: every request also passes through session validation (`Session.revokedAt`/`expiresAt`) and coarse role authorization (`requireRole()`). A revoked session cannot reach `canAccess()` at all — see [security-architecture.md](../security-architecture.md).

## Gaps against the full spec (§42's full role list)

`PROVIDER_ADMIN`, `ORG_ADMIN`, `INTEGRATION_ADMIN`, `PLATFORM_SUPPORT`, `SUPER_ADMIN` exist as enum values so the schema doesn't need a migration when that tooling is built, but no route currently branches on them — there is no admin UI or admin API surface in this phase to secure. When built, each must be threaded through `canAccess()` or an equivalently audited path, never given a shortcut.
