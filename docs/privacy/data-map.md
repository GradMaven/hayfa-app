# Data Map

Input to a future DPIA (§78). Lists what is collected, why, and where it lives — not a legal determination of lawful basis, which requires review by qualified Kenyan counsel (§77).

## Data categories collected

| Category | Fields | Table(s) | Purpose |
|---|---|---|---|
| Identity | name, email, phone, password hash | `User` | Authentication, account identification |
| Demographic | DOB, biological sex, country, county, preferred language | `PatientProfile` | Care context, localization |
| Sensitive health — conditions | diagnosis, status, severity | `Condition`, `Diagnosis` | Core clinical record |
| Sensitive health — medications | name, dose, frequency, prescriber | `Medication`, `Prescription` | Core clinical record |
| Sensitive health — results | test name, value, flag | `LabResult`, `LabTest` | Core clinical record |
| Sensitive health — measurements | type, value, timestamp | `Vital` | Trend tracking |
| Sensitive health — allergies/immunizations | allergen/reaction/severity, vaccine/dose/date | `Allergy`, `Immunization` | Safety-critical record, emergency access dataset |
| Documents | uploaded files (prescriptions, reports, etc.) + extracted OCR draft | `Document` (metadata) + object storage (bytes) | Source records, document intelligence |
| Emergency contact | name, phone | `PatientProfile` | Emergency access dataset only |
| Insurance | provider name, member ID | `PatientProfile` | Care coordination (optional field) |
| Access/authorization | who can see what, for how long | `Consent`, `CaregiverLink` | Patient-controlled sharing |
| Activity/security | login sessions, IP, user agent, access log, audit trail | `Session`, `DataAccessLog`, `AuditEvent` | Security, accountability, the Privacy Center itself |

## Data NOT collected

Per §14's "collect only what is necessary": no national ID number, no biometric data, no social security/tax identifiers, no unstructured "additional notes" dumping field on the core profile, no data collected for advertising or unrelated commercial purposes.

## Where data lives

- **Structured data**: PostgreSQL, one database, no per-tenant sharding in this phase. Region is operator-configured (`DATABASE_URL`), not hardcoded — see §80.
- **Documents (file bytes)**: S3-compatible object storage, never in the database. Local dev uses MinIO; production points at a real S3-compatible bucket via env vars only.
- **Sessions/tokens**: hashed in PostgreSQL (`Session.tokenHash`); the raw token exists only in the browser's `HttpOnly` cookie.
- **AI**: in this phase, nothing leaves the process — the only `AIProvider` implementation is a local deterministic mock. When a real vendor is wired, this section must be updated with: vendor name, region, retention policy, and whether prompts are logged.

## Third parties with data access

None in this phase. No analytics SDK, no error-tracking SDK, no email/SMS vendor is integrated (`EMAIL_PROVIDER=console` logs to server stdout only). This section must be updated the moment any of those is added — see [data-retention.md](data-retention.md) for why "a feature exists" isn't the same as "compliance is handled."
