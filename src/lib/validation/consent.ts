import { z } from "zod";
import { DATA_SCOPES } from "@/lib/consent";

// Never a simplistic "allow doctor to see my records" toggle — always
// explicit scopes + explicit duration (§28).
export const createConsentSchema = z.object({
  recipientType: z.enum(["PROVIDER", "CAREGIVER", "ORGANIZATION"]),
  // The recipient must be an existing Hafya account — resolved server-side
  // from the email so the grant is immediately enforceable by canAccess(),
  // never a dangling label that looks like access but grants none (§28).
  recipientEmail: z.string().trim().toLowerCase().email(),
  purpose: z.string().trim().min(1).max(500),
  dataScopes: z.array(z.enum(DATA_SCOPES)).min(1, "Select at least one type of information to share."),
  duration: z.enum(["ONE_TIME", "HOURS_24", "DAYS_7", "DAYS_30", "UNTIL_REVOKED"]),
});
export type CreateConsentInput = z.infer<typeof createConsentSchema>;

export const revokeConsentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const caregiverInviteSchema = z.object({
  caregiverEmail: z.string().trim().toLowerCase().email(),
  relationship: z.string().trim().max(100).optional(),
  permissions: z.array(z.enum(DATA_SCOPES)).min(1, "Select at least one type of information to share."),
});
export type CaregiverInviteInput = z.infer<typeof caregiverInviteSchema>;
