# Admin Architecture

## Scope: provider verification + organization management

`product-architecture.md` previously bucketed "Admin Portal, Organizations, Subscription/Billing, Analytics, full Integrations, API Platform" together as "Not built." This is deliberately **not** a general admin dashboard — two narrow, concrete capabilities: reviewing and approving/rejecting self-registered provider accounts, and managing the `Organization` rows a provider can affiliate with. `UserRole` already models `ORG_ADMIN`, `INTEGRATION_ADMIN`, and `PLATFORM_SUPPORT` (only `SUPER_ADMIN` is used so far), and `Subscription`/`Integration` already exist in the schema, but none of that is wired to anything yet — user (account) suspension, billing, analytics, and full third-party integrations all remain out of scope. See "What's deferred" below.

## Why this needed a registration flow, not just a review queue

`HealthcareProvider.verificationStatus` has defaulted to `PENDING` since the original build, but nothing ever created a provider registration to review — the only `HealthcareProvider` row in existence was the demo seed's, hardcoded straight to `VERIFIED`. Building only the admin-facing queue would have left it permanently empty for any real deployment. So this pass is two halves:

1. **`POST /api/v1/auth/provider-signup`** ([`src/app/api/v1/auth/provider-signup/route.ts`](../src/app/api/v1/auth/provider-signup/route.ts)) — self-serve provider registration, always creating `role: "PROVIDER"` and `verificationStatus: "PENDING"`. Deliberately a **separate route** from `POST /api/v1/auth/signup`, not a `role` field added to it — accepting a client-suppliable role on the general signup endpoint would be a privilege-escalation footgun. There is no client-reachable path anywhere in this codebase that creates a `VERIFIED` provider or any admin role directly.
2. **The admin queue** ([`src/app/admin/`](../src/app/admin/)) — where a `SUPER_ADMIN` reviews what registration produced.

A pending provider can sign in and use `/portal` immediately (same non-blocking philosophy as email verification, see [security-architecture.md](security-architecture.md)) — a persistent banner explains their status, and their clinical writes are tagged `verificationStatus: UNVERIFIED` (via the existing `sourceForActor()`/`verificationForActor()`, unchanged) until approved. `canAccess()` itself doesn't check `providerVerified` — a patient can already grant a pending provider consent and they can already access what's granted, exactly as before this work; verification affects trust/provenance labeling of their writes, not whether they can act at all. This is an existing product characteristic this work didn't change, not a gap it introduced.

## Structure

```
POST /api/v1/auth/provider-signup          self-serve registration → PENDING (organizationId optional)
GET  /api/v1/organizations                  public, verified-only org list — populates the signup picker
GET  /portal                                shows a "verification pending/not approved" banner for the provider

GET  /admin                                 SUPER_ADMIN-only queue (own minimal shell, like /portal)
GET  /api/v1/admin/providers?status=        list by status (default PENDING), includes organizationId/Name
POST /api/v1/admin/providers/:id/verify     → VERIFIED, audit event, notifies the provider
POST /api/v1/admin/providers/:id/reject     → REJECTED (reason required), audit event, notifies the provider
PATCH /api/v1/admin/providers/:id/organization  assign/clear a provider's organization — independent of the
                                                 verify/reject decision, so a provider's affiliation can be
                                                 corrected at any time

GET  /admin/organizations                   SUPER_ADMIN organization management (nav tab alongside the queue)
GET  /api/v1/admin/organizations            list ALL organizations (verified + unverified), with provider counts
POST /api/v1/admin/organizations            create (defaults verified: false, same as the Organization model's
                                             own Prisma default — an admin typing details in isn't itself
                                             verification; that's still a second, explicit step)
PATCH /api/v1/admin/organizations/:id       update name/type/county, toggle verified
DELETE /api/v1/admin/organizations/:id      soft delete
```

Every admin decision writes an `AuditEvent` (`PROVIDER_VERIFIED`/`PROVIDER_REJECTED`/`PROVIDER_ORGANIZATION_ASSIGNED`/`ORGANIZATION_CREATED`/`ORGANIZATION_UPDATED`/`ORGANIZATION_DELETED`, actor = the admin) and, for provider verify/reject, calls `notify()` so the provider is never left wondering — the same notification infrastructure every other feature in this codebase uses (in-app + email, SMS if `NEXT_PUBLIC_ENABLE_SMS` is on and they have a phone).

## Why `requireRole("SUPER_ADMIN")` alone is sufficient here, unlike patient data

[security-architecture.md](security-architecture.md) states: *"No route in this phase grants an admin role implicit access to patient clinical data... must call `canAccess()` like every other actor."* This still holds — nothing here reads or writes anything patient-scoped. `HealthcareProvider`, `Organization`, and `User` are account/identity/institutional records, not clinical data; role-based gating is the correct and sufficient check for administering them, the same way it's sufficient for a user managing their own account settings. Extending admin capability to anything patient-scoped in the future must go through `canAccess()` or a separately-audited support-access flow, never a role check alone — this pass doesn't touch that boundary at all.

## A real bug this surfaced and fixed: `.cuid()` validation on non-cuid ids

Live-verifying the organization-assignment UI against the seed data immediately hit `422 VALIDATION_ERROR` on every attempt — the same bug class as `documentId` earlier in this codebase's history (see [provider-portal-architecture.md](provider-portal-architecture.md) and `lib/validation/documents.ts`/`corrections.ts`). `Organization.id` is usually a real Prisma-generated cuid (every organization created through `POST /api/v1/admin/organizations` gets one), but the seed data deliberately uses human-readable ids (`"demo-org-nairobi-hospital"`, `"demo-org-mombasa-clinic"`) for the two demo organizations. `assignOrganizationSchema.organizationId` and `providerSignUpSchema.organizationId` were both `z.string().cuid()`, which rejected every real assignment or registration involving either seeded organization — not an edge case, the only two organizations that existed. Fixed both to `z.string().min(1)`, since there's no single guaranteed ID format to validate against (real orgs get cuids, seeded ones don't) — the correct check is just "non-empty," the same reasoning already applied to `documentId`. Regression tests added to both `organization.test.ts` and `provider.test.ts` asserting a human-readable id like the seed's is accepted, not just a cuid.

## Demo accounts (seed data)

- `admin.demo@hafya.demo` — `SUPER_ADMIN` (Amara Ochieng). No API path creates this role; it's seed/ops-only, by design.
- `dr.kariuki.demo@hafya.demo` — a second demo provider (Dr. Peter Kariuki, Cardiology), seeded `PENDING` and affiliated with the seeded unverified organization, specifically so both the provider queue and the organization queue have something real to review out of the box, without needing manually-inserted test data.
- Organizations: `Nairobi Hospital (Demo)` (verified — Dr. Mwangi's), `Mombasa Coastal Clinic (Demo)` (unverified — Dr. Kariuki's, demonstrates the verify workflow).

## Verified live against the running app

Provider verification: signed in as the seeded admin, confirmed the queue's Pending tab showed the seeded pending provider (Dr. Kariuki); registered a second test provider through the real `POST /api/v1/auth/provider-signup` endpoint and confirmed it appeared too; rejected it with a reason through the UI, confirmed it moved to the Rejected tab, confirmed the exact reason text landed in the provider's rejection email (Mailpit) and in the `AuditEvent`; approved Dr. Kariuki through the UI, confirmed he moved to the Verified tab alongside Dr. Mwangi (with her organization name correctly shown); confirmed the full `PROVIDER_REGISTERED` → `PROVIDER_REJECTED`/`PROVIDER_VERIFIED` audit trail with correct actor attribution; signed in as the rejected test provider and confirmed the "Verification not approved" banner rendered on `/portal`.

Organization management: confirmed both seeded organizations rendered correctly on `/admin/organizations` with accurate provider counts and verified/unverified badges; toggled Mombasa Coastal Clinic's verified flag on and off through the UI; hit and fixed the `.cuid()` bug above while testing provider-organization reassignment through the queue's inline picker, then confirmed the fix by reassigning Dr. Kariuki to Nairobi Hospital and back through the actual UI (not just the API); confirmed the public `GET /api/v1/organizations` endpoint correctly excludes the unverified organization; registered a real test provider through the signup flow with an organization selected from that public list and confirmed the affiliation landed correctly in the database. All test accounts and their audit trails removed afterward; both organizations and both demo providers restored to their exact seed-defined state.

## What's deferred

- User account management (view all accounts, suspend/deactivate via `User.status`) — nothing reads or writes `UserStatus` yet.
- A platform-wide audit dashboard (a UI over `AuditEvent` across all users, as opposed to querying it directly as done for verification above).
- Organization staff management beyond the single provider↔organization link (no concept of an org-level admin managing their own org's roster — that's what `ORG_ADMIN` would be for).
- `ORG_ADMIN`, `INTEGRATION_ADMIN`, `PLATFORM_SUPPORT` roles remain modeled but unused anywhere in the codebase.
- Billing/subscriptions, analytics, and full third-party integrations — unchanged from before this work.
