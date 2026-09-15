import { z } from "zod";

export const medicationSchema = z.object({
  name: z.string().trim().min(1).max(300),
  dose: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(100).optional(),
  route: z.string().trim().max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  purpose: z.string().trim().max(500).optional(),
  relatedConditionId: z.string().cuid().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "DISCONTINUED", "PAUSED"]).default("ACTIVE"),
});
export type MedicationInput = z.infer<typeof medicationSchema>;

export const conditionSchema = z.object({
  name: z.string().trim().min(1).max(300),
  category: z.enum(["diabetes", "hypertension", "asthma", "cardiovascular", "maternal", "other"]).optional(),
  dateDiagnosed: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "MANAGED", "RESOLVED"]).default("ACTIVE"),
  severity: z.enum(["MILD", "MODERATE", "SEVERE"]).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type ConditionInput = z.infer<typeof conditionSchema>;

export const labResultSchema = z.object({
  testName: z.string().trim().min(1).max(200),
  resultValue: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(50).optional(),
  referenceRange: z.string().trim().max(100).optional(),
  flag: z.enum(["NORMAL", "LOW", "HIGH", "CRITICAL"]).default("NORMAL"),
  testDate: z.coerce.date(),
  providerName: z.string().trim().max(200).optional(),
  laboratoryName: z.string().trim().max(200).optional(),
  // Document.id is a UUID (crypto.randomUUID()), not a cuid — see the
  // comment on ocrConfirmSchema.documentId in lib/validation/documents.ts.
  documentId: z.string().uuid().optional(),
});
export type LabResultInput = z.infer<typeof labResultSchema>;

export const vitalSchema = z.object({
  type: z.enum([
    "BLOOD_PRESSURE",
    "BLOOD_GLUCOSE",
    "WEIGHT",
    "HEART_RATE",
    "TEMPERATURE",
    "OXYGEN_SATURATION",
    "HEIGHT",
    "BMI",
  ]),
  value: z.coerce.number(),
  secondaryValue: z.coerce.number().optional(), // e.g. diastolic for BLOOD_PRESSURE
  unit: z.string().trim().min(1).max(20),
  recordedAt: z.coerce.date(),
});
export type VitalInput = z.infer<typeof vitalSchema>;

export const allergySchema = z.object({
  allergen: z.string().trim().min(1).max(200),
  reaction: z.string().trim().max(500).optional(),
  severity: z.enum(["MILD", "MODERATE", "SEVERE", "UNKNOWN"]).default("UNKNOWN"),
  notedDate: z.coerce.date().optional(),
});
export type AllergyInput = z.infer<typeof allergySchema>;

export const immunizationSchema = z.object({
  vaccineName: z.string().trim().min(1).max(200),
  doseNumber: z.coerce.number().int().positive().optional(),
  administeredDate: z.coerce.date(),
  providerName: z.string().trim().max(200).optional(),
  lotNumber: z.string().trim().max(100).optional(),
});
export type ImmunizationInput = z.infer<typeof immunizationSchema>;

export const appointmentSchema = z.object({
  providerName: z.string().trim().max(200).optional(),
  scheduledAt: z.coerce.date(),
  reason: z.string().trim().max(500).optional(),
  location: z.string().trim().max(300).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("SCHEDULED"),
  notes: z.string().trim().max(2000).optional(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;

export const carePlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  goal: z.string().trim().min(1).max(1000),
  conditionId: z.string().cuid().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "DISCONTINUED"]).default("ACTIVE"),
});
export type CarePlanInput = z.infer<typeof carePlanSchema>;
