import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, withApiErrors } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/current-user";
import { authorizePatientAccess, resolvePatientId } from "@/lib/api/patient-scope";

// Backs the patient's health-command-center dashboard (§15). One aggregate
// call instead of the client firing off eight — cheaper, and it's the one
// place that has to stay honest about "never fill the dashboard with
// meaningless charts": every section here maps to something the UI actually
// renders meaningfully or omits.
export async function GET(request: NextRequest) {
  return withApiErrors(async () => {
    const actor = await requireUser();
    const patientId = resolvePatientId(actor, request.nextUrl.searchParams.get("patientId"));
    await authorizePatientAccess(request, { patientId, scope: "CONDITIONS", action: "VIEW", resourceType: "DashboardSummary" });

    const now = new Date();
    const [
      activeConditions,
      allergies,
      activeMedications,
      recentVitals,
      upcomingAppointments,
      recentLabs,
      recentImmunizations,
      recentEvents,
    ] = await Promise.all([
      db.condition.findMany({ where: { patientId, deletedAt: null, status: { in: ["ACTIVE", "MANAGED"] } } }),
      db.allergy.findMany({ where: { patientId, deletedAt: null } }),
      db.medication.findMany({ where: { patientId, deletedAt: null, status: "ACTIVE" } }),
      db.vital.findMany({ where: { patientId, deletedAt: null }, orderBy: { recordedAt: "desc" }, take: 20 }),
      db.appointment.findMany({
        where: { patientId, deletedAt: null, status: "SCHEDULED", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      db.labResult.findMany({ where: { patientId, deletedAt: null }, orderBy: { testDate: "desc" }, take: 5 }),
      db.immunization.findMany({ where: { patientId, deletedAt: null }, orderBy: { administeredDate: "desc" }, take: 5 }),
      db.healthEvent.findMany({ where: { patientId }, orderBy: { eventDate: "desc" }, take: 8 }),
    ]);

    return apiSuccess({
      activeConditions,
      allergies,
      activeMedications,
      recentVitals,
      upcomingAppointments,
      recentLabs,
      recentImmunizations,
      recentActivity: recentEvents,
    });
  });
}
