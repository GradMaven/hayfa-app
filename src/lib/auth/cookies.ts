import { cookies } from "next/headers";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "hafya_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? "30");

export async function setSessionCookie(rawToken: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}
