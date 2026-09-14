import { db } from "@/lib/db";
import { featureFlags } from "@/lib/feature-flags";
import { getEmailProvider } from "@/lib/email";
import { notificationEmail } from "@/lib/email/templates";
import type { NotificationType } from "@prisma/client";

// NotificationProvider abstraction (§39–40). IN_APP and EMAIL are wired to a
// real provider (see lib/email — console in dev, SMTP against any real
// vendor in production); SMS/USSD/PUSH are modeled in the schema and the
// interface but routed nowhere until ENABLE_SMS/ENABLE_USSD are turned on
// and a real provider is plugged in — never send sensitive medical detail
// over SMS by default (§39).

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
  const user = await db.user.findUnique({ where: { id: params.userId }, select: { name: true, email: true } });
  if (user?.email) {
    const { subject, html, text } = notificationEmail({ name: user.name, title: params.title, body: params.body });
    try {
      await getEmailProvider().send({ to: user.email, subject, html, text });
    } catch (err) {
      console.error("[email] failed to send notification email:", err instanceof Error ? err.message : err);
    }
  }

  if (featureFlags.sms) {
    console.info("[sms] ENABLE_SMS is on but no SMS provider is wired yet — no message sent.");
  }
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { status: "READ", readAt: new Date() },
  });
}
