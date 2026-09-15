import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Alert } from "@/components/ui/alert";
import { PortalOverview } from "./portal-overview";

export default async function PortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role === "PATIENT") redirect("/dashboard");

  const providerStatus =
    user.role === "PROVIDER"
      ? (await db.healthcareProvider.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }))
          ?.verificationStatus
      : null;

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-5">
        <Logo />
        <SignOutButton />
      </header>
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-2xl w-full mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.role === "PROVIDER" ? "Provider portal" : "Caregiver access"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {user.role === "PROVIDER"
            ? "Patients who have granted you access. Open a patient to view their record and add diagnoses, prescriptions, or care plans within what they've shared."
            : "Patients who have added you as a caregiver, and what you're authorized to see. A full caregiver record-browsing view is coming in a later phase."}
        </p>

        {providerStatus === "PENDING" && (
          <Alert tone="warning" title="Verification pending" className="mt-4">
            An administrator hasn&apos;t reviewed your registration yet. You can use the portal, but any records you
            add will be marked unverified until you&apos;re approved.
          </Alert>
        )}
        {providerStatus === "REJECTED" && (
          <Alert tone="danger" title="Verification not approved" className="mt-4">
            Your provider registration wasn&apos;t approved. Contact support if you believe this was a mistake.
          </Alert>
        )}

        <PortalOverview role={user.role} />
      </main>
    </div>
  );
}
