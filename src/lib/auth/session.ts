import { db } from "@/lib/db";
import { generateOpaqueToken, hashToken } from "./tokens";
import type { Session, User } from "@prisma/client";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? "30");

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

export async function createSession(
  userId: string,
  ctx: SessionContext = {}
): Promise<{ rawToken: string; session: Session }> {
  const rawToken = generateOpaqueToken();
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { rawToken, session };
}

export async function validateSessionToken(
  rawToken: string
): Promise<{ session: Session; user: User } | null> {
  const tokenHash = hashToken(rawToken);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE" || session.user.deletedAt) return null;

  // Sliding activity timestamp — cheap enough to do unconditionally at this
  // scale; if it ever isn't, throttle to "update at most once per N minutes".
  await db.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  const { user, ...sessionOnly } = session;
  return { session: sessionOnly, user };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, id: { not: keepSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
}
