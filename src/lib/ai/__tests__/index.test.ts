import { describe, expect, it } from "vitest";
import { screenForHighRisk, getAIProvider } from "../index";

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
