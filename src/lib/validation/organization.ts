import { z } from "zod";

export const ORGANIZATION_TYPES = [
  "HOSPITAL",
  "CLINIC",
  "LABORATORY",
  "PHARMACY",
  "INSURER",
  "NGO",
  "EMPLOYER",
  "COUNTY_PROGRAM",
] as const;

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Enter an organization name.").max(200),
  type: z.enum(ORGANIZATION_TYPES),
  county: z.string().trim().max(100).optional(),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

export const organizationUpdateSchema = organizationSchema.partial().extend({
  verified: z.boolean().optional(),
});
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

// Organization.id is usually a real cuid (Prisma's @default(cuid()) fires
// for every org created through POST /api/v1/admin/organizations), but the
// seed data deliberately uses human-readable ids ("demo-org-nairobi-hospital")
// for the two demo organizations — the same reason Document.id and
// CorrectionRequest resourceId needed non-.cuid() validation elsewhere in
// this codebase (see lib/validation/documents.ts, corrections.ts). A
// .cuid() check here rejected every real assignment involving a seeded
// organization; caught via live verification, not a pre-existing test.
export const assignOrganizationSchema = z.object({
  organizationId: z.string().min(1).nullable(),
});
export type AssignOrganizationInput = z.infer<typeof assignOrganizationSchema>;
