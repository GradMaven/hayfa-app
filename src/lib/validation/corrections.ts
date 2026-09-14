import { z } from "zod";

// Supported resource types for the data-correction workflow (§56). Kept to
// the three most clinically central record types — see
// docs/security-architecture.md "Data correction workflow" for scope reasoning.
export const correctionResourceTypes = ["MEDICATION", "CONDITION", "LAB_RESULT"] as const;
export type CorrectionResourceType = (typeof correctionResourceTypes)[number];

export const correctionRequestSchema = z.object({
  resourceType: z.enum(correctionResourceTypes),
  resourceId: z.string().cuid(),
  reason: z.string().trim().min(1).max(1000),
  correctedFields: z
    .record(z.string(), z.unknown())
    .refine((v) => Object.keys(v).length > 0, { message: "At least one field must be corrected." }),
});
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
