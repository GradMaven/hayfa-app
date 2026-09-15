import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnthropicOCRProvider, type AnthropicOcrClientLike } from "../index";

// A fake client matching only the shape AnthropicOCRProvider actually calls
// — see AnthropicOcrClientLike in lib/ocr/index.ts. Lets these tests verify
// real request-building and response-parsing logic without a network call
// or a real API key, which this environment doesn't have.
function fakeClient(responseText: string) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: responseText }] });
  return { client: { messages: { create } } as AnthropicOcrClientLike, create };
}

const VALID_RESPONSE = JSON.stringify({
  documentType: "LAB_REPORT",
  rawText: "HbA1c: 7.4% (ref <5.7%)",
  fields: [
    { label: "Test Name", value: "HbA1c", confidence: 0.95 },
    { label: "Result", value: "7.4", confidence: 0.92 },
  ],
  overallConfidence: 0.9,
});

describe("AnthropicOCRProvider — request shape", () => {
  it("sends the document as a base64 image block for an image mime type", async () => {
    const { client, create } = fakeClient(VALID_RESPONSE);
    const provider = new AnthropicOCRProvider(client);

    await provider.extract({ buffer: Buffer.from("fake-bytes"), mimeType: "image/png" });

    expect(create).toHaveBeenCalledTimes(1);
    const call = create.mock.calls[0][0];
    expect(call.model).toBeTruthy();
    expect(call.temperature).toBe(0);
    const content = call.messages[0].content;
    const imageBlock = content.find((b: { type: string }) => b.type === "image");
    expect(imageBlock.source.media_type).toBe("image/png");
    expect(imageBlock.source.data).toBe(Buffer.from("fake-bytes").toString("base64"));
  });

  it("sends the document as a base64 PDF document block for application/pdf", async () => {
    const { client, create } = fakeClient(VALID_RESPONSE);
    const provider = new AnthropicOCRProvider(client);

    await provider.extract({ buffer: Buffer.from("fake-pdf-bytes"), mimeType: "application/pdf" });

    const content = create.mock.calls[0][0].messages[0].content;
    const docBlock = content.find((b: { type: string }) => b.type === "document");
    expect(docBlock.source.media_type).toBe("application/pdf");
  });

  it("falls back to image/jpeg for an unrecognized image mime type rather than sending an invalid one", async () => {
    const { client, create } = fakeClient(VALID_RESPONSE);
    const provider = new AnthropicOCRProvider(client);

    await provider.extract({ buffer: Buffer.from("x"), mimeType: "image/heic" });

    const content = create.mock.calls[0][0].messages[0].content;
    const imageBlock = content.find((b: { type: string }) => b.type === "image");
    expect(imageBlock.source.media_type).toBe("image/jpeg");
  });

  it("the system prompt instructs the model never to invent values and to only use JSON, not markdown", async () => {
    const { client, create } = fakeClient(VALID_RESPONSE);
    const provider = new AnthropicOCRProvider(client);
    await provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" });
    const system = create.mock.calls[0][0].system;
    expect(system.toLowerCase()).toContain("never invent");
    expect(system.toLowerCase()).toContain("json");
  });
});

describe("AnthropicOCRProvider — response parsing", () => {
  it("parses a well-formed JSON response into an OcrResult", async () => {
    const { client } = fakeClient(VALID_RESPONSE);
    const provider = new AnthropicOCRProvider(client);
    const result = await provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" });
    expect(result.documentType).toBe("LAB_REPORT");
    expect(result.fields).toHaveLength(2);
    expect(result.overallConfidence).toBe(0.9);
  });

  it("strips a markdown code fence around the JSON if the model adds one anyway", async () => {
    const { client } = fakeClient("```json\n" + VALID_RESPONSE + "\n```");
    const provider = new AnthropicOCRProvider(client);
    const result = await provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" });
    expect(result.documentType).toBe("LAB_REPORT");
  });

  it("throws (without leaking vendor error details) when the response is not valid JSON", async () => {
    const { client } = fakeClient("Sorry, I can't read this document clearly.");
    const provider = new AnthropicOCRProvider(client);
    await expect(provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" })).rejects.toThrow(
      "OCR provider returned an unexpected response."
    );
  });

  it("throws when the JSON is valid but doesn't match the expected shape", async () => {
    const { client } = fakeClient(JSON.stringify({ foo: "bar" }));
    const provider = new AnthropicOCRProvider(client);
    await expect(provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" })).rejects.toThrow(
      "OCR provider returned an unexpected response."
    );
  });

  it("rejects a hallucinated documentType outside the known enum", async () => {
    const { client } = fakeClient(
      JSON.stringify({ documentType: "MADE_UP_TYPE", rawText: "x", fields: [], overallConfidence: 0.5 })
    );
    const provider = new AnthropicOCRProvider(client);
    await expect(provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" })).rejects.toThrow();
  });

  it("accepts documentType: null when the model can't tell", async () => {
    const { client } = fakeClient(
      JSON.stringify({ documentType: null, rawText: "unclear", fields: [], overallConfidence: 0.2 })
    );
    const provider = new AnthropicOCRProvider(client);
    const result = await provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" });
    expect(result.documentType).toBeNull();
  });

  it("throws (without leaking vendor error details) when the API call itself fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("upstream rate limit exceeded: request-id=abc123"));
    const provider = new AnthropicOCRProvider({ messages: { create } });

    let caught: unknown;
    try {
      await provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain("request-id");
  });

  it("throws if the response has no text content block", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "tool_use" }] });
    const provider = new AnthropicOCRProvider({ messages: { create } });
    await expect(provider.extract({ buffer: Buffer.from("x"), mimeType: "image/jpeg" })).rejects.toThrow();
  });
});

describe("AnthropicOCRProvider — construction", () => {
  const originalKey = process.env.AI_API_KEY;
  beforeEach(() => {
    process.env.AI_API_KEY = originalKey;
  });

  it("throws a clear error if constructed without an injected client and no AI_API_KEY is set", () => {
    delete process.env.AI_API_KEY;
    expect(() => new AnthropicOCRProvider()).toThrow(/AI_API_KEY/);
  });

  it("does not throw when a client is injected, even without AI_API_KEY", () => {
    delete process.env.AI_API_KEY;
    const { client } = fakeClient(VALID_RESPONSE);
    expect(() => new AnthropicOCRProvider(client)).not.toThrow();
  });
});
