# Consent Model

Technical implementation of §27–28's consent requirements. Distinguishes three things the brief sometimes uses "consent" for loosely — they are different mechanisms in this codebase and must not be conflated:

## 1. `Consent` — patient grants a provider/organization time-boxed, scoped access

Fields: `recipientType`, `recipientUserId`, `purpose`, `dataScopes[]`, `duration`, `grantedAt`, `expiresAt`, `status`, `revokedAt`, `revocationReason`. Created only by the owning patient (`POST /api/v1/consents`, checked against `actor.patientProfileId`, not delegated to the general `canAccess()` engine — granting is an owner-only action, distinct from consuming one). Consumed by `canAccess()` on every subsequent request from that recipient.

**Lifecycle**: `ACTIVE` → `EXPIRED` (lazily flipped on read via `expireStaleConsents()`, since there's no background job in this phase) or `ACTIVE` → `REVOKED` (immediate, patient-initiated, `POST /api/v1/consents/:id/revoke`). Once non-`ACTIVE`, `canAccess()` denies and logs the denial — there is no grace period.

## 2. `CaregiverLink` — patient grants a specific person standing, scoped access

Structurally similar to `Consent` but modeled separately because the relationship itself (spouse, parent, caregiver) is longer-lived and not really "for a purpose with an expiry" in the same sense — see §4. `permissions[]` uses the same scope vocabulary as `Consent.dataScopes`. Revocation (`status: REVOKED`) is immediate and patient-initiated.

## 3. `EmergencyAccess` — policy-authorized, not patient-granted

Deliberately **not** a `Consent` variant. See [database-architecture.md](../database-architecture.md) "Why EmergencyAccess is its own model" and [security-architecture.md](../security-architecture.md) "Emergency access is not a backdoor." The patient's only lever here is the `PatientProfile.emergencyAccessEnabled` on/off switch (`/settings`) — they don't grant or scope individual emergency requests, by design, since the point of emergency access is that the patient may be unable to.

## The scope vocabulary

`MEDICATIONS`, `ALLERGIES`, `APPOINTMENTS`, `LAB_RESULTS`, `CONDITIONS`, `DOCUMENTS`, `VITALS`, `IMMUNIZATIONS`, `CARE_PLANS`, `MENTAL_HEALTH`, `INSURANCE` — one list (`DATA_SCOPES` in [`src/lib/consent/index.ts`](../../src/lib/consent/index.ts)), shared by both `Consent.dataScopes` and `CaregiverLink.permissions`, so a scope means the same thing regardless of which grant mechanism used it. Note `MENTAL_HEALTH` exists in the vocabulary per §28's explicit example but there is no dedicated mental-health record type in this phase's schema — it's reserved for when one exists, not currently enforced against any table.

## What "no simplistic toggle" means concretely

`createConsentSchema` and `caregiverInviteSchema` both require `dataScopes`/`permissions` to be a non-empty array (Zod `.min(1)`) — there is no code path, client or server, that can create a grant covering "everything." The grant form UI presents each scope as an individual checkbox, unchecked by default.

## Consent evaluation is always re-derived, never cached

`canAccess()` queries the database on every call — it does not read from a session claim, JWT payload, or any cache that could go stale relative to a revocation. See [security-architecture.md](../security-architecture.md).
