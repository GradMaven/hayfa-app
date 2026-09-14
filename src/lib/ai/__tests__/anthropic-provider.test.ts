import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnthropicAIProvider, type AnthropicClientLike } from "../index";

// A fake client matching only the shape AnthropicAIProvider actually calls —
// see AnthropicClientLike in lib/ai/index.ts. This lets these tests verify
// real request-building and response-parsing logic (system prompts, safety
// screening, error handling) without a network call or a real API key,
// which this environment doesn't have.
function fakeClient(responseText: string) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: responseText }] });
  return { client: { messages: { create } } as AnthropicClientLike, create };
}

describe("AnthropicAIProvider — request shape", () => {
  it("sends model, temperature, system prompt, and a single user message", async () => {
    const { client, create } = fakeClient("A plain-language summary.");
    const provider = new AnthropicAIProvider(client);

    await provider.explainLabResult({ type: "LabResult", id: "1", label: "HbA1c", resultText: "7.4% (ref <5.7%)" });

    expect(create).toHaveBeenCalledTimes(1);
    const call = create.mock.calls[0][0];
    expect(call.model).toBeTruthy();
    expect(call.temperature).toBe(0.2);
    expect(call.max_tokens).toBeGreaterThan(0);
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe("user");
    expect(call.messages[0].content).toContain("HbA1c");
    expect(call.messages[0].content).toContain("7.4%");
  });

  it("uses a distinct system prompt per feature", async () => {
    const { client, create } = fakeClient("ok");
    const provider = new AnthropicAIProvider(client);

    await provider.explainLabResult({ type: "LabResult", id: "1", label: "HbA1c", resultText: "7.4%" });
    const labSystem = create.mock.calls[0][0].system;

    await provider.prepareForVisit([{ type: "LAB", id: "1", label: "HbA1c 7.4%" }]);
    const visitSystem = create.mock.calls[1][0].system;

    expect(labSystem).not.toBe(visitSystem);
    expect(labSystem.toLowerCase()).toContain("laboratory");
    expect(visitSystem.toLowerCase()).toContain("questions");
  });

  it("every system prompt carries the emergency-escalation instruction", async () => {
    const { client, create } = fakeClient("ok");
    const provider = new AnthropicAIProvider(client);

    await provider.explainLabResult({ type: "LabResult", id: "1", label: "HbA1c", resultText: "7.4%" });
    await provider.prepareForVisit([{ type: "LAB", id: "1", label: "x" }]);
    await provider.summarizeDocument({ type: "Document", id: "1", label: "doc", extractedText: "text" });
    await provider.summarizeTimeline([{ type: "LAB", id: "1", label: "x" }], "the last 90 days");

    for (const call of create.mock.calls) {
      expect(call[0].system.toLowerCase()).toContain("emergency");
    }
  });

  it("never lets the model diagnose or prescribe per the system prompt instructions", async () => {
    const { client, create } = fakeClient("ok");
    const provider = new AnthropicAIProvider(client);
    await provider.explainLabResult({ type: "LabResult", id: "1", label: "HbA1c", resultText: "7.4%" });
    const system = create.mock.calls[0][0].system;
    expect(system.toLowerCase()).toContain("never diagnose");
  });
});

describe("AnthropicAIProvider — response handling", () => {
  it("returns the model's text, current timestamp, sources, and the standard disclaimer", async () => {
    const { client } = fakeClient("Your HbA1c was 7.4%, within the range your lab reported.");
    const provider = new AnthropicAIProvider(client);
    const record = { type: "LabResult", id: "1", label: "HbA1c", resultText: "7.4%" };

    const response = await provider.explainLabResult(record);

    expect(response.text).toBe("Your HbA1c was 7.4%, within the range your lab reported.");
    expect(response.sources).toEqual([record]);
    expect(response.disclaimer.length).toBeGreaterThan(0);
    expect(new Date(response.generatedAt).getTime()).not.toBeNaN();
  });

  it("throws (without leaking vendor error details) when the API call fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("upstream rate limit exceeded: request-id=abc123"));
    const provider = new AnthropicAIProvider({ messages: { create } });

    let caught: unknown;
    try {
      await provider.explainLabResult({ type: "LabResult", id: "1", label: "x", resultText: "y" });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    // The thrown error is intentionally generic — the raw vendor message
    // (which can include request internals) is logged server-side only,
    // never propagated to a route's response.
    expect((caught as Error).message).not.toContain("request-id");
  });

  it("throws if the response has no text content block", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "tool_use" }] });
    const provider = new AnthropicAIProvider({ messages: { create } });
    await expect(provider.explainLabResult({ type: "LabResult", id: "1", label: "x", resultText: "y" })).rejects.toThrow();
  });

  it("short-circuits summarizeTimeline with no API call when there are no records", async () => {
    const { client, create } = fakeClient("unused");
    const provider = new AnthropicAIProvider(client);
    const response = await provider.summarizeTimeline([], "the last 90 days");
    expect(create).not.toHaveBeenCalled();
    expect(response.text).toContain("No recorded health events");
  });

  it("short-circuits prepareForVisit with no API call when there are no records", async () => {
    const { client, create } = fakeClient("unused");
    const provider = new AnthropicAIProvider(client);
    const response = await provider.prepareForVisit([]);
    expect(create).not.toHaveBeenCalled();
    expect(response.sources).toEqual([]);
  });
});

describe("AnthropicAIProvider — safety screening (§25)", () => {
  it("flags URGENT_CARE_RECOMMENDED when the model's OWN output mentions a high-risk term, even if the input didn't", async () => {
    const { client } = fakeClient("This may be linked to chest pain — please seek care.");
    const provider = new AnthropicAIProvider(client);
    const response = await provider.explainLabResult({ type: "LabResult", id: "1", label: "Troponin", resultText: "elevated" });
    expect(response.safetyFlag).toBe("URGENT_CARE_RECOMMENDED");
  });

  it("flags URGENT_CARE_RECOMMENDED when the INPUT mentions a high-risk term, even if the model's reply doesn't repeat it", async () => {
    const { client } = fakeClient("Reviewed the recorded events for this period.");
    const provider = new AnthropicAIProvider(client);
    const response = await provider.summarizeTimeline(
      [{ type: "ENCOUNTER", id: "1", label: "Patient reported severe chest pain overnight" }],
      "the last 7 days"
    );
    expect(response.safetyFlag).toBe("URGENT_CARE_RECOMMENDED");
  });

  it("does not flag routine input/output", async () => {
    const { client } = fakeClient("Your blood pressure readings have been stable this month.");
    const provider = new AnthropicAIProvider(client);
    const response = await provider.summarizeTimeline(
      [{ type: "VITAL", id: "1", label: "Blood pressure recorded: 120/80" }],
      "the last 30 days"
    );
    expect(response.safetyFlag).toBe("NONE");
  });
});

describe("AnthropicAIProvider — construction", () => {
  const originalKey = process.env.AI_API_KEY;
  beforeEach(() => {
    process.env.AI_API_KEY = originalKey;
  });

  it("throws a clear error if constructed without an injected client and no AI_API_KEY is set", () => {
    delete process.env.AI_API_KEY;
    expect(() => new AnthropicAIProvider()).toThrow(/AI_API_KEY/);
  });

  it("does not throw when a client is injected, even without AI_API_KEY", () => {
    delete process.env.AI_API_KEY;
    const { client } = fakeClient("ok");
    expect(() => new AnthropicAIProvider(client)).not.toThrow();
  });
});
