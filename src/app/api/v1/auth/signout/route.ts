import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { revokeSession } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/cookies";

export async function POST() {
  return withApiErrors(async () => {
    const user = await getCurrentUser();
    if (user) await revokeSession(user.sessionId);
    await clearSessionCookie();
    return apiSuccess({ signedOut: true });
  });
}
