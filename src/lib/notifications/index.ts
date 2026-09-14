import { db } from "@/lib/db";
import { featureFlags } from "@/lib/feature-flags";
import type { NotificationType } from "@prisma/client";

// NotificationProvider abstraction (§39–40). Only IN_APP and EMAIL are wired;
// SMS/USSD/PUSH are modeled in the schema and the interface but routed
// nowhere until ENABLE_SMS/ENABLE_USSD are turned on and a real provider is
// plugged in — never send sensitive medical detail over SMS by default (§39).

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

  if (process.env.EMAIL_PROVIDER === "console") {
    // Dev-only stand-in for a real email provider (SES/Postmark/etc). Never
    // put full clinical detail in the notification body itself (§39) —
    // bodies here are meant to be short pointers ("New lab result available")
    // and the recipient opens the app to see anything sensitive.
    console.info(`[email:mock] to user ${params.userId} — ${params.title}: ${params.body}`);
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
