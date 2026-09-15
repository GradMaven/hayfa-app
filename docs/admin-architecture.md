# Admin Architecture

## Scope: provider verification only

`product-architecture.md` previously bucketed "Admin Portal, Organizations, Subscription/Billing, Analytics, full Integrations, API Platform" together as "Not built." This is deliberately **not** a general admin dashboard — it's one narrow, concrete capability: reviewing and approving/rejecting self-registered provider accounts. `UserRole` already models `ORG_ADMIN`, `INTEGRATION_ADMIN`, `PLATFORM_SUPPORT`, and `SUPER_ADMIN`, and `Organization`/`Subscription`/`Integration` already exist in the schema, but none of that is wired to anything yet — user (account) suspension, organization management, billing, analytics, and full third-party integrations all remain out of scope, same as before this work. See "What's deferred" below.

## Why this needed a registration flow, not just a review queue

`HealthcareProvider.verificationStatus` has defaulted to `PENDING` since the original build, but nothing ever created a provider registration to review — the only `HealthcareProvider` row in existence was the demo seed's, hardcoded straight to `VERIFIED`. Building only the admin-facing queue would have left it permanently empty for any real deployment. So this pass is two halves:

1. **`POST /api/v1/auth/provider-signup`** ([`src/app/api/v1/auth/provider-signup/route.ts`](../src/app/api/v1/auth/provider-signup/route.ts)) — self-serve provider registration, always creating `role: "PROVIDER"` and `verificationStatus: "PENDING"`. Deliberately a **separate route** from `POST /api/v1/auth/signup`, not a `role` field added to it — accepting a client-suppliable role on the general signup endpoint would be a privilege-escalation footgun. There is no client-reachable path anywhere in this codebase that creates a `VERIFIED` provider or any admin role directly.
2. **The admin queue** ([`src/app/admin/`](../src/app/admin/)) — where a `SUPER_ADMIN` reviews what registration produced.

A pending provider can sign in and use `/portal` immediately (same non-blocking philosophy as email verification, see [security-architecture.md](security-architecture.md)) — a persistent banner explains their status, and their clinical writes are tagged `verificationStatus: UNVERIFIED` (via the existing `sourceForActor()`/`verificationForActor()`, unchanged) until approved. `canAccess()` itself doesn't check `providerVerified` — a patient can already grant a pending provider consent and they can already access what's granted, exactly as before this work; verification affects trust/provenance labeling of their writes, not whether they can act at all. This is an existing product characteristic this work didn't change, not a gap it introduced.

## Structure

```
POST /api/v1/auth/provider-signup          self-serve registration → PENDING
GET  /portal                                shows a "verification pending/not approved" banner for the provider

GET  /admin                                 SUPER_ADMIN-only queue (own minimal shell, like /portal)
GET  /api/v1/admin/providers?status=        list by status (default PENDING)
POST /api/v1/admin/providers/:id/verify     → VERIFIED, audit event, notifies the provider
POST /api/v1/admin/providers/:id/reject     → REJECTED (reason required), audit event, notifies the provider
```

Every decision writes an `AuditEvent` (`PROVIDER_VERIFIED`/`PROVIDER_REJECTED`, actor = the admin, metadata includes the license number and, for rejection, the reason) and calls `notify()` so the provider is never left wondering — the same notification infrastructure every other feature in this codebase uses (in-app + email, SMS if `NEXT_PUBLIC_ENABLE_SMS` is on and they have a phone).

## Why `requireRole("SUPER_ADMIN")` alone is sufficient here, unlike patient data

[security-architecture.md](security-architecture.md) states: *"No route in this phase grants an admin role implicit access to patient clinical data... must call `canAccess()` like every other actor."* This still holds — nothing here reads or writes anything patient-scoped. `HealthcareProvider` and `User` are account/identity records, not clinical data; role-based gating is the correct and sufficient check for administering them, the same way it's sufficient for a user managing their own account settings. Extending admin capability to anything patient-scoped in the future must go through `canAccess()` or a separately-audited support-access flow, never a role check alone — this pass doesn't touch that boundary at all.

## Demo accounts (seed data)

- `admin.demo@hafya.demo` — `SUPER_ADMIN` (Amara Ochieng). No API path creates this role; it's seed/ops-only, by design.
- `dr.kariuki.demo@hafya.demo` — a second demo provider (Dr. Peter Kariuki, Cardiology), seeded `PENDING` specifically so the admin queue has something real to review out of the box, without needing manually-inserted test data.

## Verified live against the running app

Signed in as the seeded admin: confirmed the queue's Pending tab showed the seeded pending provider (Dr. Kariuki); registered a second test provider through the real `POST /api/v1/auth/provider-signup` endpoint and confirmed it appeared too; rejected it with a reason through the UI, confirmed it moved to the Rejected tab, confirmed the exact reason text landed in the provider's rejection email (Mailpit) and in the `AuditEvent`; approved Dr. Kariuki through the UI, confirmed he moved to the Verified tab alongside Dr. Mwangi (with her organization name correctly shown); confirmed the full `PROVIDER_REGISTERED` → `PROVIDER_REJECTED`/`PROVIDER_VERIFIED` audit trail with correct actor attribution; signed in as the rejected test provider and confirmed the "Verification not approved" banner rendered on `/portal`. Test account and its audit trail removed afterward; Dr. Kariuki restored to `PENDING` so the seed demo scenario stays intact for future exploration.

## What's deferred

- Organization management (create/edit/verify `Organization` rows, assign a provider to one at registration) — a registering provider has no way to name their workplace this pass; `organizationId` stays `null` until this is built.
- User account management (view all accounts, suspend/deactivate via `User.status`) — nothing reads or writes `UserStatus` yet.
- A platform-wide audit dashboard (a UI over `AuditEvent` across all users, as opposed to querying it directly as done for verification above).
- `ORG_ADMIN`, `INTEGRATION_ADMIN`, `PLATFORM_SUPPORT` roles remain modeled but unused anywhere in the codebase.
- Billing/subscriptions, analytics, and full third-party integrations — unchanged from before this work.
