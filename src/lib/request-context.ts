import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return undefined;
}

export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get("user-agent") ?? undefined;
}
