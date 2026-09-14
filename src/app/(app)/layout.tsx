import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  // This entire shell — and every page under it — assumes a PatientProfile
  // (resolvePatientId defaults to the signed-in patient's own record).
  // Provider/caregiver portals are a documented Phase 2 scope cut (see
  // docs/discovery-report.md) — send them to the small honest overview
  // instead of a dashboard that will 422 on every request.
  if (user.role !== "PATIENT") redirect("/portal");

  // Golden path §99: profile creation happens before anything else for a
  // patient account.
  if (!user.patientProfileId) redirect("/onboarding");

  return (
    <AppShell user={{ name: user.name, role: user.role, email: user.email }}>
      {children}
    </AppShell>
  );
}
