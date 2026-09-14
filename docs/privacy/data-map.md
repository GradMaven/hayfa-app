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
- **AI**: `AIProvider` defaults to a local deterministic mock — nothing leaves the process. When an operator sets `AI_PROVIDER=anthropic` with a real `AI_API_KEY`, the *minimal data a given feature needs* (never a full record — see [ai-architecture.md](../ai-architecture.md) "Data governance") is sent to Anthropic's API (the vendor is **Anthropic PBC**; see Anthropic's published data-processing and retention terms for the Claude API at the time of deployment — this document doesn't restate third-party terms that can change). No prompt or response content is logged or persisted by this app beyond a generic vendor-error message on failure.
- **Email**: `EmailProvider` ([`src/lib/email/index.ts`](../../src/lib/email/index.ts)) defaults to `console` (nothing leaves the process). When `EMAIL_PROVIDER=smtp` is configured against a real vendor, the *recipient's own email address plus the message content* (password-reset link, a notification title/body) transits that vendor's infrastructure — see "Third parties" below.
- **Malware scanning**: every uploaded document's raw bytes are sent to a ClamAV daemon for scanning before anything is persisted (`MALWARE_SCAN_PROVIDER=clamav`, the default). This is **not** a third party by default — ClamAV is self-hosted, operator-controlled infrastructure (`CLAMAV_HOST`/`CLAMAV_PORT` point at infrastructure you run, same trust boundary as the database), not a SaaS vendor. It would only become a third-party data path if an operator deliberately pointed it at someone else's hosted ClamAV instance, which this app doesn't do by default or recommend.

## Third parties with data access

No analytics SDK and no error-tracking SDK are integrated in this phase. Two third parties *can* be in the data path, each only once an operator deliberately opts in:

- **Email vendor** — once `EMAIL_PROVIDER=smtp` is configured with real SMTP credentials (Amazon SES, SendGrid, Postmark, Mailgun, etc. — see [ENVIRONMENT.md](../../ENVIRONMENT.md)); the local/default `console` mode sends nothing anywhere. What transits the vendor: the recipient's email address and the notification/reset-email content (never full clinical detail — see §39 and `src/lib/email/templates.ts`, which caps every template to a short title/body or a reset link, nothing else).
- **AI vendor (Anthropic)** — once `AI_PROVIDER=anthropic` is configured with a real `AI_API_KEY`; the local/default mock sends nothing anywhere. What transits the vendor: the minimal per-feature data described above (event labels/titles, a lab result value, extracted document text, or a care-plan-adjacent free-text field — never the patient's full record).

**[LEGAL REVIEW NEEDED, per dpia.md]**: confirm each chosen vendor's data processing terms and region satisfy Kenyan data-protection requirements for its respective category of data before enabling either in an environment touching real patient data.
