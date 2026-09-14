import { z } from "zod";

// Collect only what §14 lists as necessary — no free-form "additional notes"
// dumping ground on the core profile.
export const patientProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  dateOfBirth: z.coerce.date().max(new Date()),
  biologicalSex: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]).default("UNSPECIFIED"),
  country: z.string().trim().min(2).max(100).default("Kenya"),
  county: z.string().trim().max(100).optional(),
  preferredLanguage: z.enum(["en", "sw"]).default("en"),
  bloodType: z
    .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN"])
    .default("UNKNOWN"),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  insuranceProvider: z.string().trim().max(200).optional(),
  insuranceMemberId: z.string().trim().max(100).optional(),
});
export type PatientProfileInput = z.infer<typeof patientProfileSchema>;

export const patientProfileUpdateSchema = patientProfileSchema.partial();
