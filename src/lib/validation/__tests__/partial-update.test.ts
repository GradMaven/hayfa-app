import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pickProvidedFields } from "../partial-update";

describe("pickProvidedFields", () => {
  const schema = z.object({
    dose: z.string().optional(),
    status: z.enum(["ACTIVE", "PAUSED"]).default("ACTIVE"),
  });

  it("drops a defaulted field the caller never sent", () => {
    const raw = { dose: "10mg" };
    const parsed = schema.partial().parse(raw);
    // Sanity check on the bug this guards against: Zod's own partial().parse()
    // silently fills in the default for the omitted `status` field.
    expect(parsed).toEqual({ dose: "10mg", status: "ACTIVE" });

    const result = pickProvidedFields(parsed, raw);
    expect(result).toEqual({ dose: "10mg" });
    expect(result).not.toHaveProperty("status");
  });

  it("keeps a field the caller explicitly sent, defaulted or not", () => {
    const raw = { status: "PAUSED" };
    const parsed = schema.partial().parse(raw);
    const result = pickProvidedFields(parsed, raw);
    expect(result).toEqual({ status: "PAUSED" });
  });
});
