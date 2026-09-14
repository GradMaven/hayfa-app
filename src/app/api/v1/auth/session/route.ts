import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  return withApiErrors(async () => {
    const user = await getCurrentUser();
    return apiSuccess({ user });
  });
}
