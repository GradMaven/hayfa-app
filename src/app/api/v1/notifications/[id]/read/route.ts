import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { markNotificationRead } from "@/lib/notifications";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const { id } = await params;
    await markNotificationRead(id, actor.id);
    return apiSuccess({ read: true });
  });
}
