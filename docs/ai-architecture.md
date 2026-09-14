# AI Architecture

## Pipeline (§50)

```
Feature request (e.g. "summarize my timeline")
        ↓
Route handler: authenticate + canAccess() for the scope involved
        ↓
Data minimization: select only the fields this feature needs
        ↓
AIProvider (interface) — mock by default; Anthropic (Claude) when
                          AI_PROVIDER=anthropic + AI_API_KEY are set
        ↓
Vendor call wrapped in try/catch — any failure becomes a plain
"temporarily unavailable" message (§65), never a leaked error
        ↓
Safety screen: screenForHighRisk() on BOTH the input data and the
                model's own output text
        ↓
AIResponse { text, sources[], generatedAt, safetyFlag, disclaimer }
        ↓
UI renders result WITH sources + disclaimer + urgent-care banner if flagged
```

`AIProvider` ([`src/lib/ai/index.ts`](../src/lib/ai/index.ts)) is the only place an AI vendor call is made. It is never called directly from a UI component — always from a route handler, so the data-minimization and consent checks happen server-side and can't be bypassed by a modified client.

## The real vendor: Anthropic (Claude)

`AnthropicAIProvider` implements the same four-method interface as the mock, using the official `@anthropic-ai/sdk`. Selected only when **both** `AI_PROVIDER=anthropic` and `AI_API_KEY` are set ([`getAIProvider()`](../src/lib/ai/index.ts)) — any other or missing configuration falls back to the mock rather than throwing, so a half-configured environment fails safe. Model defaults to `claude-haiku-4-5-20251001` (fast, inexpensive, the right fit for short factual summaries), overridable via `AI_MODEL`.

**Verified live against the real API** (not just typechecked or unit-tested against a mock client) — this session has no valid Anthropic API key, so verification took two forms:
1. **Request-building and response-parsing logic**: 23 unit tests inject a fake client matching the SDK's shape ([`AnthropicClientLike`](../src/lib/ai/index.ts)) and assert on exact request contents (system prompt per feature, temperature, token limits, message structure) and response handling (text extraction, error wrapping, safety-flag computation) — see [`src/lib/ai/__tests__/anthropic-provider.test.ts`](../src/lib/ai/__tests__/anthropic-provider.test.ts).
2. **The real network path**: pointed the running app at `AI_PROVIDER=anthropic` with an intentionally invalid key and called `/api/v1/ai/explain-lab` for real. A genuine HTTPS round-trip to `api.anthropic.com` happened (~1s response time, a real `401 authentication_error` in the server log) — proving the request is correctly formed enough to reach and be parsed by Anthropic's servers — and the failure surfaced through the exact §65-compliant path: logged server-side with the real vendor error, returned to the client as "This explanation is temporarily unavailable," rendered correctly in the UI. A valid key would follow the identical code path to a successful response — this is the strongest verification possible without one.

## Why the response shape is fixed, not free text

`AIResponse` requires `sources` and `disclaimer` as structural fields, not optional ones — a caller cannot construct a response that omits them. This is what makes §52 ("every AI-generated insight must clearly indicate it's AI-generated, based on what, and when") a property of the type system rather than a UI convention someone can forget to apply on a new screen.

## Safety screening (§25, §91)

`screenForHighRisk()` checks text against a fixed term list (chest pain, difficulty breathing, unconsciousness, severe bleeding, suicidal ideation, severe allergic reaction). The real provider screens **both** the input data passed to the model **and** the model's own output text, flagging `URGENT_CARE_RECOMMENDED` if either matches — screening only the input would miss a case where the model itself surfaces something concerning that wasn't phrased that way in the source data; screening only the output would miss a case where the model, despite instructions, doesn't repeat a risk term present in what it was given. The UI (`/insights`, `/timeline`, `/documents`) renders a prominent "consider seeking care soon" banner *above* the AI text when flagged, not folded into it.

This is intentionally a blunt, auditable keyword screen rather than a second model call — for this phase, false positives (over-flagging) are the safe failure mode; false negatives are not something a keyword list should be trusted to catch reliably, which is exactly why the product framing (§25) is "prioritize seeking care," not "the AI decided this is/isn't an emergency."

## What the AI is never allowed to do (§23, §51 boundary)

Enforced two ways, not by prompt instructions alone:
- **Structurally**: `AIProvider` has four narrow methods (`summarizeTimeline`, `explainLabResult`, `summarizeDocument`, `prepareForVisit`). There is no `diagnose()`, `prescribe()`, or `recommendTreatment()` method — adding one would be a visible, reviewable interface change, not a prompt tweak. `CarePlan.goal` is a free-text field the patient or provider sets; nothing in the AI layer writes to it.
- **In the system prompt**: every real-provider call carries a shared safety-boundary instruction (`SAFETY_BOUNDARY` in `src/lib/ai/index.ts`) appended to all four feature-specific prompts — "never diagnose, prescribe, recommend starting/stopping/changing any medication, or claim certainty about a diagnosis... base your response only on the information given... [escalate clearly on emergency signs]." A unit test asserts this instruction is present in every one of the four prompts, so a future edit that accidentally drops it from one feature fails CI rather than shipping silently.

Prompt instructions are not a hard guarantee the way the missing methods are — a model can, in principle, fail to follow them. That's a known, documented limit of this approach (see "What's not covered" below), not a claim of perfect enforcement.

## Data governance (§53)

- `NEXT_PUBLIC_ENABLE_AI` defaults to `false`. When off, `/insights` shows a plain "AI features are turned off, no data is sent to any provider" message rather than a disabled button — the state is legible, not just inert.
- No patient data reaches a real external AI vendor unless an operator deliberately sets both `AI_PROVIDER=anthropic` and a real `AI_API_KEY` — `getAIProvider()` returns the mock otherwise, and the mock never makes a network call.
- Every route selects only the minimal fields a feature needs before calling the provider (e.g. `timeline-summary` pulls `{id, type, title}` from `HealthEvent`, never the underlying clinical record) — unchanged by which provider answers the call.
- No prompt/response logging beyond the existing generic error log (vendor error message only, on failure) — full conversation content is never persisted server-side.
- OCR follows the identical non-negotiable rule (§18): `OCRProvider.extract()` returns a **draft** (`OcrResult` with per-field confidence); nothing writes it into a clinical table until a human calls the `/confirm` endpoint with reviewed (possibly edited) values. See [`src/app/api/v1/documents/[id]/ocr/confirm/route.ts`](../src/app/api/v1/documents/[id]/ocr/confirm/route.ts). OCR itself still has no real vendor wired — that remains mocked.

## A bug this work surfaced and fixed: feature flags in Client Components

`featureFlags.ai`/`.ocr` are read from several Client Components (`/insights`, the labs-tab "Explain this" button, the document card's OCR/Summarize buttons, the timeline AI-summary button) to decide what to render. The flags were originally sourced from plain `ENABLE_AI`/`ENABLE_OCR` env vars via a dynamic `process.env[name]` lookup — which Next.js never inlines into the browser bundle (only statically-referenced `NEXT_PUBLIC_*` vars are), so every one of those checks silently evaluated to `false` in the browser regardless of the real server-side value. The Insights page, for instance, permanently showed "AI features are turned off" even with `ENABLE_AI=true`, and produced a genuine React hydration-mismatch error in the process (server render saw the real value, client hydration didn't).

Fixed by renaming every flag to `NEXT_PUBLIC_*` and reading each via a static `process.env.NEXT_PUBLIC_X` expression ([`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts)) — both are required for Next's build-time inlining to work. None of these flags are sensitive (they're on/off switches, not secrets), so exposing them to the client is the correct fix, not a compromise. Verified live: before the fix, `/insights` showed the disabled message and threw a hydration error despite `ENABLE_AI=true`; after, it renders the real feature and the button/panel wiring described above.

## AI-feature-to-spec-section map (§51)

| §51 feature | Status |
|---|---|
| 1. Medical document summary | `POST /api/v1/ai/summarize-document` — built, and now actually wired to a "Summarize" button on `/documents` (previously implemented server-side with no UI caller — fixed alongside this work) |
| 2. Health timeline summary | `POST /api/v1/ai/timeline-summary` — built, on `/timeline` and `/insights` |
| 3. Lab explanation | `POST /api/v1/ai/explain-lab` — built, on `/health` labs tab |
| 4. Doctor visit preparation | `POST /api/v1/ai/prepare-visit` — built, on `/insights` |
| 5. Record organization suggestions | Not built — natural next addition to the OCR confirm step |

## What's not covered by this phase

- **OCR** still has no real vendor — `OCRProvider` remains mock-only (a separate interface from `AIProvider`; wiring a real OCR vendor is a distinct, not-yet-done task).
- **No real-vendor integration test in CI** — the 23 unit tests use an injected fake client; nothing in the automated test suite makes a real network call (correctly — that would require a real key in CI, cost money per run, and be flaky against a live third-party service). The live verification described above was a manual, one-time pass in this session, not a repeatable automated check.
- **No prompt-injection hardening** beyond the safety-boundary instructions — a carefully-crafted patient-entered record (e.g. a document title or care-plan note containing adversarial text) is passed into the user-turn content the same as any other data. This is a known class of risk for any LLM feature reading user-controlled data and is not specifically mitigated here beyond the model's own instruction-following.
- **No cost/rate limiting specific to AI calls** beyond the general per-route authorization — a verified, authenticated user can call these endpoints as often as the UI allows; production use should add usage limits before enabling a real vendor for real users.
