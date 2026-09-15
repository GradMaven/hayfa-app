// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getOcrProvider, AnthropicOCRProvider, _resetOcrProviderForTests } from "../index";

describe("MockOCRProvider", () => {
  it("returns a draft result with per-field confidence, never a finished record", async () => {
    const provider = getOcrProvider();
    const result = await provider.extract({ buffer: Buffer.from("fake"), mimeType: "image/jpeg" });
    expect(result.fields.length).toBeGreaterThan(0);
    for (const field of result.fields) {
      expect(field.confidence).toBeGreaterThanOrEqual(0);
      expect(field.confidence).toBeLessThanOrEqual(1);
    }
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
  });
});

describe("getOcrProvider — provider selection", () => {
  const originalProvider = process.env.OCR_PROVIDER;
  const originalKey = process.env.AI_API_KEY;

  beforeEach(() => {
    _resetOcrProviderForTests();
  });

  afterEach(() => {
    process.env.OCR_PROVIDER = originalProvider;
    process.env.AI_API_KEY = originalKey;
    _resetOcrProviderForTests();
  });

  it("defaults to the mock provider when OCR_PROVIDER is unset", () => {
    delete process.env.OCR_PROVIDER;
    delete process.env.AI_API_KEY;
    const provider = getOcrProvider();
    expect(provider).not.toBeInstanceOf(AnthropicOCRProvider);
  });

  it("uses the mock provider even with OCR_PROVIDER=anthropic if AI_API_KEY is missing — fails safe, not throws", () => {
    process.env.OCR_PROVIDER = "anthropic";
    delete process.env.AI_API_KEY;
    const provider = getOcrProvider();
    expect(provider).not.toBeInstanceOf(AnthropicOCRProvider);
  });

  // Constructs a real `Anthropic` client (construction only — no network
  // call happens without invoking a method on it). Same reasoning as
  // lib/ai/__tests__/index.test.ts for running this file under
  // @vitest-environment node.
  it("selects the real Anthropic provider only when both OCR_PROVIDER=anthropic and AI_API_KEY are set", () => {
    process.env.OCR_PROVIDER = "anthropic";
    process.env.AI_API_KEY = "sk-test-fake-key-for-construction-only";
    const provider = getOcrProvider();
    expect(provider).toBeInstanceOf(AnthropicOCRProvider);
  });

  it("is a singleton across calls until reset", () => {
    delete process.env.OCR_PROVIDER;
    const a = getOcrProvider();
    const b = getOcrProvider();
    expect(a).toBe(b);
  });
});
