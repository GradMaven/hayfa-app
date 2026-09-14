import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId } from "@/lib/api/patient-scope";
import { appointmentSchema } from "@/lib/validation/clinical";
import { recordHealthEvent } from "@/lib/health-events";
import { notify } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "APPOINTMENTS", action: "VIEW", resourceType: "Appointment" });

    const records = await db.appointment.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { scheduledAt: "asc" },
      include: { provider: { select: { fullName: true, specialty: true } } },
    });
    return apiSuccess(records);
  });
}

export async function POST(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const body = await request.json();
    const patientId = resolvePatientId(actor, body.patientId);
    await authorizePatientAccess(request, { patientId, scope: "APPOINTMENTS", action: "CREATE", resourceType: "Appointment" });

    const input = appointmentSchema.parse(body);
    const record = await db.appointment.create({ data: { patientId, ...input } });

    await recordHealthEvent({
      patientId,
      type: "APPOINTMENT",
      title: `${record.status === "SCHEDULED" ? "Upcoming" : "Appointment"}: ${record.reason ?? "Visit"}`,
      eventDate: record.scheduledAt,
      sourceEntityType: "Appointment",
      sourceEntityId: record.id,
    });

    const patientUser = await db.patientProfile.findUnique({ where: { id: patientId }, select: { userId: true } });
    if (patientUser) {
      await notify({
        userId: patientUser.userId,
        type: "APPOINTMENT",
        title: "Appointment scheduled",
        body: `${record.reason ?? "A visit"} on ${record.scheduledAt.toDateString()}.`,
        relatedEntityType: "Appointment",
        relatedEntityId: record.id,
      });
    }

    return apiSuccess(record, undefined, 201);
  });
}
