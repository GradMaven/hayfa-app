import { db } from "@/lib/db";
import { featureFlags } from "@/lib/feature-flags";
import { getEmailProvider } from "@/lib/email";
import { notificationEmail } from "@/lib/email/templates";
import { getSmsProvider, buildSmsBody } from "@/lib/sms";
import type { NotificationType } from "@prisma/client";

// NotificationProvider abstraction (§39–40). IN_APP, EMAIL, and now SMS are
// wired to real providers (see lib/email — console in dev, SMTP against any
// real vendor in production; lib/sms — console in dev, Africa's Talking
// against a real vendor). USSD/PUSH remain modeled in the schema and the
// interface but routed nowhere — USSD in particular is not a push channel
// at all (there is no "send a USSD message" vendor API; it only exists as an
// inbound dial-in session), so it can't be wired the same way SMS was. See
// docs/notification-architecture.md. Never send sensitive medical detail over
// SMS (§39) — enforced by callers of notify(), which pass short pointers,
// not this function.

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function notify(params: NotifyParams): Promise<void> {
  await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      channel: "IN_APP",
      title: params.title,
      body: params.body,
      status: "SENT",
      sentAt: new Date(),
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });

  // Never put full clinical detail in the notification body itself (§39) —
  // bodies here are meant to be short pointers ("New lab result available")
  // and the recipient opens the app to see anything sensitive; that
  // constraint is enforced by callers of notify(), not by this function.
  const user = await db.user.findUnique({ where: { id: params.userId }, select: { name: true, email: true, phone: true } });
  if (user?.email) {
    const { subject, html, text } = notificationEmail({ name: user.name, title: params.title, body: params.body });
    try {
      await getEmailProvider().send({ to: user.email, subject, html, text });
    } catch (err) {
      console.error("[email] failed to send notification email:", err instanceof Error ? err.message : err);
    }
  }

  if (featureFlags.sms && user?.phone) {
    try {
      await getSmsProvider().send({ to: user.phone, message: buildSmsBody(params.title, params.body) });
    } catch (err) {
      console.error("[sms] failed to send notification sms:", err instanceof Error ? err.message : err);
    }
  }
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { status: "READ", readAt: new Date() },
  });
}
