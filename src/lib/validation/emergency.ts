import { z } from "zod";

export const emergencyAccessRequestSchema = z.object({
  patientEmail: z.string().trim().toLowerCase().email(),
  reason: z.string().trim().min(10, "Describe the emergency reason (at least 10 characters).").max(500),
  verificationMethod: z.string().trim().max(200).optional(),
});
export type EmergencyAccessRequestInput = z.infer<typeof emergencyAccessRequestSchema>;
