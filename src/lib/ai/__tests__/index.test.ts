// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { screenForHighRisk, getAIProvider, AnthropicAIProvider, _resetAIProviderForTests } from "../index";

describe("screenForHighRisk", () => {
  it("flags chest pain", () => {
    expect(screenForHighRisk("Patient reports chest pain since this morning")).toBe(true);
  });

  it("flags suicidal ideation regardless of case", () => {
    expect(screenForHighRisk("Notes mention SUICIDAL thoughts")).toBe(true);
  });

  it("does not flag routine text", () => {
    expect(screenForHighRisk("Annual checkup, blood pressure within normal range")).toBe(false);
  });
});

describe("MockAIProvider safety behavior", () => {
  it("surfaces URGENT_CARE_RECOMMENDED when source events mention a high-risk term", async () => {
    const provider = getAIProvider();
    const response = await provider.summarizeTimeline(
      [{ type: "ENCOUNTER", id: "1", label: "Reported chest pain and shortness of breath" }],
      "the last 7 days"
    );
    expect(response.safetyFlag).toBe("URGENT_CARE_RECOMMENDED");
  });

  it("every response carries its source records and a disclaimer (§52 AI transparency)", async () => {
    const provider = getAIProvider();
    const response = await provider.summarizeTimeline([{ type: "LAB", id: "1", label: "HbA1c 7.4%" }], "the last 90 days");
    expect(response.sources).toHaveLength(1);
    expect(response.disclaimer.length).toBeGreaterThan(0);
    expect(response.generatedAt).toBeTruthy();
  });
});

describe("getAIProvider — provider selection", () => {
  const originalProvider = process.env.AI_PROVIDER;
  const originalKey = process.env.AI_API_KEY;

  beforeEach(() => {
    _resetAIProviderForTests();
  });

  afterEach(() => {
    process.env.AI_PROVIDER = originalProvider;
    process.env.AI_API_KEY = originalKey;
    _resetAIProviderForTests();
  });

  it("defaults to the mock provider when AI_PROVIDER is unset", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    const provider = getAIProvider();
    expect(provider).not.toBeInstanceOf(AnthropicAIProvider);
  });

  it("uses the mock provider even with AI_PROVIDER=anthropic if AI_API_KEY is missing — fails safe, not throws", () => {
    process.env.AI_PROVIDER = "anthropic";
    delete process.env.AI_API_KEY;
    const provider = getAIProvider();
    expect(provider).not.toBeInstanceOf(AnthropicAIProvider);
  });

  // This constructs a real `Anthropic` client (construction only — no
  // network call happens without invoking a method on it). The SDK refuses
  // to initialize under a browser-like `window` global as a credential-leak
  // guard, which is why this whole file runs under `@vitest-environment
  // node` above rather than the project's default jsdom — correctly: the
  // guard is real and appropriate, and this app never constructs the client
  // anywhere but a server-only route handler.
  it("selects the real Anthropic provider only when both AI_PROVIDER=anthropic and AI_API_KEY are set", () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.AI_API_KEY = "sk-test-fake-key-for-construction-only";
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(AnthropicAIProvider);
  });

  it("is a singleton across calls until reset", () => {
    delete process.env.AI_PROVIDER;
    const a = getAIProvider();
    const b = getAIProvider();
    expect(a).toBe(b);
  });
});
