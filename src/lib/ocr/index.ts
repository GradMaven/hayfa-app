import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DOCUMENT_TYPES } from "@/lib/validation/documents";

// OCRProvider abstraction (§18). CRITICAL invariant: OCR output is always a
// draft. Nothing in this module — or any caller of it — may write extracted
// values directly into a clinical record (Medication/LabResult/etc). The
// result always lands as Document.ocrExtractedData + ocrStatus="COMPLETED",
// and a structured record is only created after a human calls the confirm
// endpoint, which copies user-reviewed (possibly edited) values across.

export interface OcrExtractedField {
  label: string;
  value: string;
  confidence: number; // 0–1
}

export interface OcrResult {
  documentType: string | null;
  fields: OcrExtractedField[];
  rawText: string;
  overallConfidence: number;
}

export interface OCRProvider {
  extract(params: { buffer: Buffer; mimeType: string }): Promise<OcrResult>;
}

// Deterministic mock — no network call, nothing leaves the process. This is
// what runs whenever OCR_PROVIDER isn't explicitly set to a real vendor, and
// is what this repo's own test suite always exercises. Lets the
// confirm-before-write UX (§18) be built and tested end-to-end without a
// vendor key.
class MockOCRProvider implements OCRProvider {
  async extract(): Promise<OcrResult> {
    return {
      documentType: "LAB_REPORT",
      rawText:
        "MOCK OCR OUTPUT — no vendor configured. Replace lib/ocr's provider with a real " +
        "implementation (see OCRProvider) to extract real text from uploaded documents.",
      fields: [
        { label: "Test Name", value: "HbA1c", confidence: 0.94 },
        { label: "Result", value: "7.4", confidence: 0.91 },
        { label: "Unit", value: "%", confidence: 0.97 },
        { label: "Reference Range", value: "<5.7%", confidence: 0.88 },
      ],
      overallConfidence: 0.92,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Anthropic (Claude) — the real vendor implementation. Selected only when
// OCR_PROVIDER=anthropic and AI_API_KEY is set (see getOcrProvider() below).
// Reuses AI_API_KEY rather than a separate OCR_API_KEY: it's the same
// vendor account already required for AI_PROVIDER=anthropic, and Claude's
// vision/document input is how this module gets OCR at all — there's no
// separate OCR product being called. See docs/ai-architecture.md.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_OCR_MODEL = "claude-sonnet-5"; // vision-capable; document/image reading benefits from the stronger model
const OCR_MAX_OUTPUT_TOKENS = 2000;
const OCR_REQUEST_TIMEOUT_MS = 30_000;

const ocrResponseSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES).nullable(),
  rawText: z.string(),
  fields: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(15),
  overallConfidence: z.number().min(0).max(1),
});

const OCR_SYSTEM_PROMPT =
  "You perform OCR and structured field extraction on a medical or administrative document (prescription, lab " +
  "report, discharge summary, imaging report, invoice, referral, vaccination card, medical certificate, or " +
  "insurance document) for a patient health-records app. You are given exactly one document as an image or PDF " +
  "attachment.\n\n" +
  "Respond with ONLY a single JSON object — no markdown code fences, no commentary before or after — matching " +
  "exactly this shape:\n" +
  '{"documentType": one of ' +
  DOCUMENT_TYPES.map((t) => `"${t}"`).join(" | ") +
  ' | null (null if you cannot tell), "rawText": the full text content of the document transcribed as ' +
  'accurately as possible, "fields": an array of at most 15 of the most clinically or administratively ' +
  'important fields you can identify, each as {"label": string, "value": string, "confidence": a number 0-1 ' +
  "reflecting your own certainty this value was read correctly — this is a self-assessment, not a measured " +
  'statistic}, "overallConfidence": a number 0-1, your overall confidence in the extraction as a whole.}\n\n' +
  "Prefer fields like Test Name/Result/Unit/Reference Range for a lab report, Medication/Dose/Frequency for a " +
  "prescription, Vaccine Name/Dose Number/Date for a vaccination card — adapt to what the document actually " +
  "contains rather than forcing it into a fixed template.\n\n" +
  "Rules: never invent a value that isn't present in the document — if a field is illegible, omit it rather " +
  "than guessing. Transcribe exactly what is written; do not correct, interpret, or diagnose. If the image is " +
  "blank, unreadable, or not a medical/administrative document, return an empty fields array, rawText " +
  "describing what you actually see, and a low overallConfidence.";

type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ACCEPTED_IMAGE_TYPES: SupportedImageMimeType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function asSupportedImageMimeType(mimeType: string): SupportedImageMimeType {
  return (ACCEPTED_IMAGE_TYPES as string[]).includes(mimeType) ? (mimeType as SupportedImageMimeType) : "image/jpeg";
}

type OcrContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: SupportedImageMimeType; data: string };
    }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

// Minimal shape this module actually uses from the SDK client — mirrors
// AnthropicClientLike in lib/ai/index.ts so tests can inject a lightweight
// fake without needing to match the SDK's full type surface.
export interface AnthropicOcrClientLike {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      temperature: number;
      system: string;
      messages: { role: "user"; content: OcrContentBlock[] }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

export class AnthropicOCRProvider implements OCRProvider {
  private client: AnthropicOcrClientLike;
  private model: string;

  constructor(client?: AnthropicOcrClientLike) {
    if (client) {
      this.client = client;
    } else {
      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) {
        throw new Error("AI_API_KEY must be set when OCR_PROVIDER=anthropic. See ENVIRONMENT.md.");
      }
      this.client = new Anthropic({ apiKey, timeout: OCR_REQUEST_TIMEOUT_MS });
    }
    this.model = process.env.OCR_MODEL || DEFAULT_OCR_MODEL;
  }

  async extract({ buffer, mimeType }: { buffer: Buffer; mimeType: string }): Promise<OcrResult> {
    const data = buffer.toString("base64");
    const documentBlock: OcrContentBlock =
      mimeType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
        : {
            type: "image",
            source: { type: "base64", media_type: asSupportedImageMimeType(mimeType), data },
          };

    let raw: string;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: OCR_MAX_OUTPUT_TOKENS,
        temperature: 0,
        system: OCR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: [documentBlock, { type: "text", text: "Extract this document as instructed." }] },
        ],
      });
      const block = response.content.find((b) => b.type === "text");
      raw = block?.text?.trim() ?? "";
      if (!raw) throw new Error("Empty response from OCR provider.");
    } catch (err) {
      // Never let vendor error details reach the caller — same reasoning as
      // lib/ai/index.ts. Logged server-side only.
      console.error("[ocr:anthropic] request failed:", err instanceof Error ? err.message : err);
      throw new Error("OCR provider request failed.");
    }

    return parseOcrResponse(raw);
  }
}

function parseOcrResponse(raw: string): OcrResult {
  let jsonText = raw.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonText = fenced[1].trim();

  let candidate: unknown;
  try {
    candidate = JSON.parse(jsonText);
  } catch {
    console.error("[ocr:anthropic] response was not valid JSON");
    throw new Error("OCR provider returned an unexpected response.");
  }

  const parsed = ocrResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    console.error("[ocr:anthropic] response did not match the expected shape:", parsed.error.message);
    throw new Error("OCR provider returned an unexpected response.");
  }
  return parsed.data;
}

let instance: OCRProvider | null = null;

// OCR_PROVIDER selects the provider: AnthropicOCRProvider only when
// OCR_PROVIDER=anthropic AND AI_API_KEY is set; the mock otherwise, so a
// misconfigured or partially-configured environment fails safe rather than
// throwing on every request — same pattern as getAIProvider() in lib/ai.
// This is independent of NEXT_PUBLIC_ENABLE_OCR, which gates whether the OCR
// routes/UI are reachable at all.
export function getOcrProvider(): OCRProvider {
  if (!instance) {
    instance =
      process.env.OCR_PROVIDER === "anthropic" && process.env.AI_API_KEY
        ? new AnthropicOCRProvider()
        : new MockOCRProvider();
  }
  return instance;
}

// Test-only: forces the next getOcrProvider() call to reconstruct the
// provider instead of reusing the module-level singleton.
export function _resetOcrProviderForTests(): void {
  instance = null;
}
