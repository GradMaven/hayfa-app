# Integration Architecture

## Principle (§34–37, §87)

No integration in this phase is real — all of it is mocked. The point of this document is the boundary that makes a real integration *additive* later: replace `MockHospitalConnector` with `RealHospitalConnector`, nothing else changes.

```
External system (hospital EHR / lab / insurer / wearable)
        ↓
HealthDataConnector (interface — authenticate, fetchPatients, fetchEncounters,
                      fetchLabs, fetchMedications, fetchDocuments)
        ↓
ExternalRecord (raw payload, stored as-is with provenance)
        ↓
Normalization / mapping (not yet built — see below)
        ↓
Canonical model (the same Prisma schema every other write path uses)
        ↓
Hafya
```

## `HealthDataConnector` ([`src/lib/integrations/connector.ts`](../src/lib/integrations/connector.ts))

A fixed interface every future connector implements. `MockHospitalConnector` implements it today, returning empty arrays — its purpose is to prove the interface compiles and is exercised (via the `Integration`/`ExternalRecord` tables), not to simulate real data. No UI is wired to it yet.

## Why raw payloads are stored (`ExternalRecord.rawPayload`)

Every import keeps the original external payload alongside the mapped entity IDs. If a mapping bug is discovered later, records can be re-mapped from the original data rather than being permanently lossy — this is the same instinct as keeping `HealthEvent` a thin index rather than a second source of truth (see [database-architecture.md](database-architecture.md)): never let a derived/transformed view become the only copy.

## Provenance is the load-bearing concept here (§31)

Every clinical record — imported or not — carries `source: DataSourceType` (`HOSPITAL_INTEGRATION`, `LAB_INTEGRATION`, `INSURANCE_INTEGRATION`, `WEARABLE`, etc.) and `verificationStatus`. A real integration doesn't need new schema to be trustworthy-labeled correctly; it needs to set these two fields honestly on write. This is why the canonical model was designed with provenance as a first-class field on every table rather than bolted on later.

## FHIR posture (§34–35)

The canonical model is FHIR-*shaped* where it costs nothing to be — e.g. `Condition`, `Allergy`, `Immunization`, `Procedure` map close to their FHIR resource namesakes; `Encounter` and `Diagnosis` are split the way FHIR splits Encounter/Condition. It is **not** a FHIR server — there is no `/fhir/*` endpoint, no FHIR JSON serialization, no terminology binding (ICD/SNOMED) enforced beyond an optional free-text `icdCode` field on `Diagnosis`. Building a FHIR-compliant export is a Phase 3 task layered on top of `/api/v1/export`, not a schema rewrite.

## Wearables (§37)

`DataSourceType.WEARABLE` exists in the schema; no wearable connector or UI exists. When built, wearable-derived vitals must remain clearly labeled by source (already automatic — `Vital.source`) and must never auto-populate a diagnosis or condition — only a human (patient or provider) creates those.

## What's deferred

Everything in §87's phrasing "a mock integration is acceptable during MVP" — real hospital/lab/insurance/wearable connectors, the normalization/mapping layer, webhooks (§49) for `record.created`/`lab.result.created`/etc., and the developer API (§48) partners would use to push data in. The interface exists so building these doesn't require touching `src/app/api/v1/*` or the Prisma schema.
