import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Consistent response envelope across every /api/v1/* route — see
// docs/api-architecture.md. Never leak stack traces or raw error objects to
// the client (§65/§91).

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, data, meta: meta ?? {} }, { status });
}

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status: STATUS_BY_CODE[code] }
  );
}

export class ApiException extends Error {
  code: ApiErrorCode;
  details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Wraps a route handler body so every route gets the same error envelope
// without repeating try/catch everywhere. Domain code throws ApiException or
// ZodError; anything else becomes an opaque 500 — the real error is logged
// server-side only, never returned to the client.
export async function withApiErrors(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof ApiException) {
      return apiError(err.code, err.message, err.details);
    }
    if (err instanceof ZodError) {
      return apiError("VALIDATION_ERROR", "Request data is invalid.", err.flatten());
    }
    console.error("[api] unhandled error", err instanceof Error ? err.message : err);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
