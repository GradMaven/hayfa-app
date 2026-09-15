import { describe, expect, it } from "vitest";
import { updateUserStatusSchema } from "../admin-user";

describe("updateUserStatusSchema", () => {
  it("accepts a valid status with no reason", () => {
    expect(updateUserStatusSchema.safeParse({ status: "SUSPENDED" }).success).toBe(true);
  });

  it("accepts a valid status with a reason", () => {
    const result = updateUserStatusSchema.safeParse({ status: "DEACTIVATED", reason: "Requested by user" });
    expect(result.success).toBe(true);
  });

  it("accepts reactivating to ACTIVE", () => {
    expect(updateUserStatusSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(updateUserStatusSchema.safeParse({ status: "BANNED" }).success).toBe(false);
  });

  it("rejects a missing status", () => {
    expect(updateUserStatusSchema.safeParse({ reason: "no status given" }).success).toBe(false);
  });
});
