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

// Separate cookie for the MFA challenge state — never the same name/value
// space as the real session cookie, so there's no risk of a half-verified
// login being mistaken for an authenticated one by any code that only
// checks "is the session cookie present."
const MFA_CHALLENGE_COOKIE_NAME = "hafya_mfa_challenge";
const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

export async function setMfaChallengeCookie(rawToken: string): Promise<void> {
  const store = await cookies();
  store.set(MFA_CHALLENGE_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MFA_CHALLENGE_TTL_SECONDS,
  });
}

export async function clearMfaChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(MFA_CHALLENGE_COOKIE_NAME);
}

export async function getMfaChallengeTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(MFA_CHALLENGE_COOKIE_NAME)?.value ?? null;
}
