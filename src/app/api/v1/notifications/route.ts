import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";

export async function GET() {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const notifications = await db.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return apiSuccess(notifications);
  });
}
