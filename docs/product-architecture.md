# Product Architecture

## What Hafya is (§1)

A patient-centered health-data platform, not a hospital management system, appointment-booker, or AI chatbot. The organizing idea: fragmented health records (hospitals, clinics, labs, paper, memory) become one patient-owned, patient-controlled record with a real audit trail over who else can see it.

## Modules and their build status (§7)

| Module | Status |
|---|---|
| Authentication | Built — custom, revocable sessions, TOTP-based MFA with backup codes, email verification (non-blocking) |
| User Profiles / Patient Health Record | Built |
| Health Timeline | Built |
| Documents + OCR + malware scanning (real ClamAV) | Built — OCR mock by default; a real vendor (Anthropic/Claude vision/document input) is wired, off by default, unit-tested but not yet live-API-verified (see ai-architecture.md) |
| Laboratory Results, Medications, Conditions, Allergies, Immunizations, Vitals, Appointments | Built — includes a patient-initiated correction workflow (§56) for medications/conditions/labs once a record is provider-verified or not patient-sourced, instead of a silent direct overwrite |
| Chronic Conditions + Care Plans | Built — includes clinician-facing care-plan authoring via the Provider Portal |
| Consent & Permissions, Data Sharing, Emergency Access | Built |
| Notifications | Built — in-app + real email (SMTP, any vendor) + real SMS (Africa's Talking), off by default, unit-tested but not yet live-API-verified; USSD is a materially different (inbound-session, not push) feature and remains deferred, push not wired — see notification-architecture.md |
| Audit Logs | Built |
| AI Health Insights | Built — mock provider by default; a real vendor (Anthropic/Claude) is wired and verified against the live API, off by default |
| Provider Portal | Built — patient list, a per-patient chart view scoped to exactly the consented record categories, and clinical-workflow write actions (diagnoses, prescriptions, care plans) — see [provider-portal-architecture.md](provider-portal-architecture.md) |
| Admin Portal | Provider verification + organization management + user account administration — a `SUPER_ADMIN` reviews/approves/rejects self-registered providers, manages the organizations they can affiliate with, and can view/suspend/deactivate/reactivate any account, see [admin-architecture.md](admin-architecture.md). Platform config remains not built. |
| Organizations | Admin-managed CRUD + verification (create/edit/verify/delete, assign a provider to one); no org-admin self-service, staff management, or org-facing dashboard — see [admin-architecture.md](admin-architecture.md). |
| Subscription/Billing, Analytics, full Integrations, API Platform | Not built — schema/interfaces exist where noted in their respective docs |

## User types and what they can actually do today

- **Patient**: the fully-built experience — profile, timeline, documents, all clinical modules, sharing, privacy center, sessions.
- **Caregiver**: backend fully modeled (`CaregiverLink`, scoped permissions enforced by `canAccess()`); UI is still the minimal `/portal` overview listing which patients granted access, not a full record browser — the Provider Portal buildout below was scoped to providers only.
- **Provider**: the Provider Portal (`/portal/patients/[patientId]`) gives a verified, consented provider a real per-patient chart — read access to exactly the record categories the patient's `Consent.dataScopes` names, plus the ability to add diagnoses, prescribe medications, and create care plans, all landing with `source: PROVIDER_ENTERED`/`verificationStatus: PROVIDER_VERIFIED` and a `DataAccessLog` entry the patient can see. Also `POST /api/v1/emergency-access` for the policy-based, consent-independent emergency path. A provider self-registers (`/provider-signup`) and starts `PENDING` until an admin approves them. See [provider-portal-architecture.md](provider-portal-architecture.md).
- **Admin (`SUPER_ADMIN`)**: `/admin` — reviews and approves/rejects pending provider registrations, manages (create/edit/verify/delete) the organizations providers can affiliate with, and can view/search/suspend/deactivate/reactivate any account (`User.status`) — enforcement (blocked sign-in, revoked sessions) was already built into auth, this just exposes it. That's the entire admin surface today; no platform config. See [admin-architecture.md](admin-architecture.md).
- **Organization**: `Organization` rows are admin-managed (create/edit/verify/delete via `/admin/organizations`); no org-admin self-service, staff management, or org-facing dashboard is built. A provider can optionally affiliate with a verified organization at self-registration.

## Golden path (§99 Step 6) — fully working end to end

Create account → create health profile → upload a document → confirm its OCR draft into a lab result → see it on the timeline → add a medication → share selected records with a provider by email → revoke that access → see both events in the access log → export the full record. This was verified against the running app (dev server + local Postgres/MinIO), not just written and assumed correct.

## Design principle carried through every module

A feature is not "the screen exists" — see §104's Definition of Done. Concretely, every clinical write in this codebase produces: a validated input (Zod), an authorized actor (`canAccess()`), a provenance-tagged record (`source`/`verificationStatus`), a timeline entry where relevant (`recordHealthEvent`), and an audit trail entry (`DataAccessLog`/`AuditEvent`) — automatically, not as an opt-in extra step a future contributor might forget.
