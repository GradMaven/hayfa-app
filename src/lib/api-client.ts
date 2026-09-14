// Thin client-side wrapper around fetch(/api/v1/*) that unwraps the
// {success, data} / {success, error} envelope from lib/api-response.ts and
// throws a normal Error the UI can catch — components never touch the raw
// envelope shape.

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const json: Envelope<T> = await res.json().catch(() => ({ success: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server response." } }));

  if (!json.success) {
    throw new ApiClientError(json.error?.code ?? "INTERNAL_ERROR", json.error?.message ?? "Something went wrong.", res.status);
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function requestWithMeta<T>(path: string, init?: RequestInit): Promise<{ data: T; meta: Record<string, unknown> }> {
  const res = await fetch(path, { ...init, credentials: "include" });
  const json: Envelope<T> = await res.json();
  if (!json.success) {
    throw new ApiClientError(json.error?.code ?? "INTERNAL_ERROR", json.error?.message ?? "Something went wrong.", res.status);
  }
  return { data: json.data as T, meta: json.meta ?? {} };
}
