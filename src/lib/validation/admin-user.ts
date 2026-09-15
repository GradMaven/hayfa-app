import { z } from "zod";

export const USER_STATUS_VALUES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUS_VALUES),
  reason: z.string().trim().max(1000).optional(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
