import { z } from "zod";
import { phoneSchema } from "./auth";

// Deliberately narrow: only the phone number, not name/email/password, which
// have their own dedicated, more security-sensitive flows. `null` clears it.
export const updatePhoneSchema = z.object({
  phone: phoneSchema.nullable(),
});
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
