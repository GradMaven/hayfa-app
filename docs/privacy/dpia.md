# Data Protection Impact Assessment — Working Draft

**Status: not a completed DPIA.** This is the technical input a qualified privacy/legal reviewer needs to complete one under the Kenya Data Protection Act, 2019 and applicable ODPC guidance (§77). Sections marked **[LEGAL REVIEW NEEDED]** are exactly that — do not treat their absence as "handled."

## 1. Processing description

Hafya stores and lets patients organize personal health records (structured clinical data + uploaded documents), and lets patients grant time-boxed, scoped access to that data to healthcare providers and caregivers. See [data-map.md](data-map.md) for the full category list.

## 2. Purpose(s) of processing

- Give an individual a unified view of their own health history (primary purpose).
- Enable patient-authorized sharing with healthcare providers for care coordination.
- Enable patient-authorized caregiver access.
- Enable policy-authorized emergency access to a minimal dataset when the patient has opted in.
- Security/accountability (audit logs, access logs) — a secondary purpose necessary to make the above trustworthy.

**[LEGAL REVIEW NEEDED]**: confirm each purpose has an appropriate lawful basis under the Data Protection Act (likely consent for the primary/sharing purposes; consider whether "vital interests" applies to emergency access — engineering has modeled emergency access as consent-adjacent-but-distinct, see [consent-model.md](consent-model.md), but has not determined its lawful basis).

## 3. Data flows

See [data-map.md](data-map.md) "Where data lives." No cross-border transfer occurs in this phase — everything runs against operator-configured infrastructure with no fixed region baked into code (§80). **[LEGAL REVIEW NEEDED]**: once a hosting region is chosen, confirm it satisfies any data-residency expectations for health data under Kenyan law.

## 4. Necessity and proportionality

Profile fields are scoped to §14's list; no field exists in the schema "in case it's useful later" — see [data-map.md](data-map.md) "Data NOT collected." AI features (when enabled) receive only the minimal fields a given feature needs, not full records (§50, see [ai-architecture.md](../ai-architecture.md)).

## 5. Risks identified and mitigations (engineering perspective)

| Risk | Mitigation | Residual risk |
|---|---|---|
| One patient accessing another's data (IDOR) | `canAccess()` object-level check on every request, re-derived from DB — see [security-architecture.md](../security-architecture.md) | Low if the pattern is followed for every new route; **process risk**, not solved by the pattern existing once |
| Provider retaining access after purpose ends | Explicit duration on every `Consent`; patient can revoke anytime; lazy expiry check | Provider could still have viewed/exported data before revocation — inherent to any access grant, mitigated by the access log being visible to the patient |
| Health data leaking via logs/analytics | No query-level logging, no analytics SDK integrated, error logs carry messages only | Re-verify on every new dependency added — nothing in the codebase currently prevents a future contributor from adding `console.log(patientData)` by mistake |
| AI vendor mishandling data | No real vendor wired in this phase; mock provider never leaves the process | Full risk re-assessment required before enabling `ENABLE_AI` with a real provider — this DPIA section is explicitly incomplete for that future state |
| Document storage exposure | No public URLs; signed URLs expire in 5 minutes; bucket is private | Depends on correct production bucket configuration — not verifiable from code alone |
| Session hijacking | HttpOnly/Secure/SameSite cookie, hashed-at-rest opaque token, immediate revocation | No IP-pinning or anomaly detection on sessions yet |

## 6. Automated decision-making (§78)

None. AI features in this phase only summarize/explain data the patient already has access to (§23) — no automated decision affecting eligibility, care, or any other outcome is made. This assessment must be revisited if that scope ever changes.

## 7. Consultation

**[LEGAL REVIEW NEEDED]**: this draft has not been reviewed by a qualified Kenyan data-protection or healthcare-regulatory professional. Do not represent this product as DPA/Digital-Health-Act compliant on the basis of this document.
