import { z } from "zod";
import { phoneSchema } from "./auth";

// Self-serve provider registration. Always creates verificationStatus:
// PENDING — there is no client-suppliable way to skip review (see
// docs/admin-architecture.md). organizationId is optional and, if given,
// checked server-side against real Organization rows (see
// POST /api/v1/auth/provider-signup) — a registering provider isn't
// required to belong to one, and picking one doesn't itself grant anything;
// it's informational until an admin's own verification decision.
export const providerSignUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: phoneSchema.optional().or(z.literal("")),
  password: z.string().min(10, "Password must be at least 10 characters."),
  specialty: z.string().trim().max(200).optional(),
  licenseNumber: z.string().trim().min(1, "Enter your license number.").max(100),
  // Not .cuid() — see the comment on assignOrganizationSchema in
  // lib/validation/organization.ts for why (seed data uses non-cuid ids).
  organizationId: z.string().min(1).optional().or(z.literal("")),
});
export type ProviderSignUpInput = z.infer<typeof providerSignUpSchema>;

export const providerRejectSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(1000),
});
export type ProviderRejectInput = z.infer<typeof providerRejectSchema>;
