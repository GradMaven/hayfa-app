import { db } from "@/lib/db";
import { apiSuccess, withApiErrors, ApiException } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { revokeSession } from "@/lib/auth/session";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;

    // Object-level check: a session can only be revoked by the user who owns
    // it, never inferred from the id alone (§43).
    const session = await db.session.findUnique({ where: { id }, select: { userId: true } });
    if (!session || session.userId !== user.id) {
      throw new ApiException("NOT_FOUND", "Session not found.");
    }

    await revokeSession(id);
    return apiSuccess({ revoked: true });
  });
}
