import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { listActiveSessions, revokeAllOtherSessions } from "@/lib/auth/session";

// Device/session management (§13, §42): the user can see every active login
// and end any of them without knowing anything about tokens.
export async function GET() {
  return withApiErrors(async () => {
    const user = await requireUser();
    const sessions = await listActiveSessions(user.id);
    return apiSuccess(
      sessions.map((s) => ({ ...s, isCurrent: s.id === user.sessionId }))
    );
  });
}

// Signs out every device except the one making this request.
export async function DELETE() {
  return withApiErrors(async () => {
    const user = await requireUser();
    await revokeAllOtherSessions(user.id, user.sessionId);
    return apiSuccess({ revoked: true });
  });
}
