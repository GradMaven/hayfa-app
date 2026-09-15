# Provider Portal Architecture

## What this closes

`docs/product-architecture.md` previously named this exact gap: *"no clinical-workflow UI (adding diagnoses, prescriptions, care plans as a provider) is built."* The backend already fully supported it — `canAccess()` already scoped what a consented provider could read and write via the API, and `sourceForActor()`/`verificationForActor()` already tagged a verified provider's writes as `PROVIDER_ENTERED`/`PROVIDER_VERIFIED` (see [security-architecture.md](security-architecture.md)). This was purely a missing UI: no page let a provider actually browse a consented patient's record or reach those write endpoints. No backend change was required to build it — the `POST /api/v1/medications`, `/conditions`, `/care-plans` (and every other clinical GET) route already worked correctly for a provider actor supplying an explicit `patientId`; they'd simply never been called from anywhere but the patient's own pages.

## Structure

```
GET /portal                                   patient list (existing, now linked into detail pages)
GET /portal/patients/[patientId]              server component: auth + consent gate, patient header
  └─ ProviderPatientRecordView (client)        tabs scoped to consent.dataScopes
       └─ per-category tab components          read-only list (all granted categories)
       └─ ProviderMedicationForm/               "Add" forms (Conditions, Medications, Care
          ConditionForm/CarePlanForm             Plans only — see "Why these three" below)
```

- [`src/app/portal/patients/[patientId]/page.tsx`](../src/app/portal/patients/[patientId]/page.tsx) — re-derives the provider's relationship to this patient from the database itself (an active, unexpired `Consent` naming this provider), the same "never trust the caller's own role check" discipline `canAccess()` already applies everywhere else — `notFound()` if no such consent exists, never inferred from anything client-supplied. Every load writes a `DataAccessLog` row (`resourceType: "PatientProfile"`, action `VIEW`) so the patient sees the provider opened their chart, not just that a specific record category was queried.
- [`src/app/portal/patients/[patientId]/provider-patient-record-view.tsx`](../src/app/portal/patients/[patientId]/provider-patient-record-view.tsx) — a tab appears **only** for a scope actually present in `consent.dataScopes`; each tab is a thin read via the existing category GET endpoint with `?patientId=` explicit (a provider has no `patientProfileId` of their own for `resolvePatientId()` to default to — see [`lib/api/patient-scope.ts`](../src/lib/api/patient-scope.ts)).
- [`src/app/portal/patients/[patientId]/provider-clinical-forms.tsx`](../src/app/portal/patients/[patientId]/provider-clinical-forms.tsx) — provider-side equivalents of the patient-facing add forms, same Zod schemas and POST endpoints, differing only in supplying an explicit `patientId` in the request body.

## Why basic demographic info needed a new access path

`GET /api/v1/patients/me` is hardcoded to the caller's own `patientProfileId` — it has no `?patientId=` param and no provider-consent path, by design (it's the patient's own profile endpoint). A provider needs baseline identity/safety context (name, age, blood type) for *any* consented clinical relationship, but there's no `"PROFILE"` entry in `DATA_SCOPES` to gate it behind — knowing who you're treating isn't itself one of the grantable record categories in this product's model. Rather than overload `/patients/me` with provider-consent logic it was never designed for, the server page component in `page.tsx` reads the patient's basic profile fields directly, gated on **any** active consent existing at all (not a specific scope) — implied by having a legitimate clinical relationship in the first place, the same reasoning `POST /api/v1/emergency-access` already applies to its own fixed minimal dataset.

## Why these three write actions (diagnoses, prescriptions, care plans) and not more

Bounded deliberately to match the exact gap named in `product-architecture.md`, not every writable resource type a provider could theoretically touch. Vitals, allergies, immunizations, appointments, and lab results remain **read-only** in this pass, shown whenever the corresponding scope is granted — a provider can see them but not add them from this portal yet. This is a scope decision to keep this pass bounded and reviewable, not a technical limitation: every one of those categories' `POST` endpoints already supports an explicit `patientId` the identical way the three write-enabled categories do, so extending write access to any of them is a small, focused addition, not new architecture.

## Consent scope note (a pre-existing product characteristic, not something this work introduced)

`canAccess()` authorizes based on whether a scope is present in `Consent.dataScopes` — it does not distinguish view vs. create/update/delete within a granted scope (see `evaluate()` in [`lib/consent/index.ts`](../src/lib/consent/index.ts): the `action` parameter is passed through for audit logging but not checked). A patient granting `MEDICATIONS` access is therefore granting both browse *and* write access to that category, not a view-only subset — this portal's write actions only reach categories the patient already granted, they don't expand what a granted scope means. The patient-facing consent-grant UI doesn't currently offer a read-only/read-write distinction either, so this is consistent with the product's existing coarse-grained-per-category model, not a new gap this work created. Worth revisiting if finer-grained consent (view-only grants) becomes a product requirement.

## Verified live against the running app

Signed in as the seeded demo provider (Dr. Jane Mwangi, `verificationStatus: VERIFIED`, an active 30-day consent for `MEDICATIONS`/`LAB_RESULTS`/`CONDITIONS`/`VITALS` on the demo patient): confirmed exactly those four tabs render (no `CARE_PLANS`/`ALLERGIES`/etc. tabs, since those scopes weren't granted); confirmed each tab's existing data renders correctly (the seeded Amlodipine prescription, the three trending HbA1c results, three blood-pressure vitals, the Hypertension diagnosis); added a real diagnosis, a real prescription, and (after temporarily granting the `CARE_PLANS` scope to exercise that path too) a real care plan — each appeared instantly in the list, and each landed with `source: PROVIDER_ENTERED`/`verificationStatus: PROVIDER_VERIFIED` confirmed directly in the database; confirmed the new diagnosis immediately appeared on the *patient's own* `/conditions` page with a "Request correction" control available (proving the data-correction workflow, [security-architecture.md](security-architecture.md), and this new write path compose correctly with zero glue code); confirmed every view and every create wrote a `DataAccessLog` row visible via `GET /api/v1/audit` — the same endpoint the patient's own Privacy Center reads. All test data (the added condition/medication/care plan, their `HealthEvent` rows, and the temporary scope grant) removed afterward; the demo consent and demo clinical records were restored to their exact original seed state.

## What's deferred

- Write access for vitals, allergies, immunizations, appointments, and lab results from the provider portal (see "Why these three" above).
- A caregiver-facing record browser — this pass was scoped to providers only; `/portal`'s caregiver view remains the existing patient-list-only overview.
- Finer-grained (view-only) consent scopes — see the consent-scope note above.
- A documents tab (would need the same signed-URL download flow the patient-facing `/documents` page already has, not yet wired into the provider context).
