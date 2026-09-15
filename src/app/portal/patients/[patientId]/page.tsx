import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { writeDataAccessLog } from "@/lib/audit";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ProviderPatientRecordView } from "./provider-patient-record-view";

// Provider-only patient chart view. Re-derives the relationship from the
// database itself (an active, unexpired Consent naming this provider) rather
// than trusting anything client-supplied — same "never trust the caller's
// own role check" discipline as canAccess() (see
// docs/security-architecture.md). Every load is itself a real access, so it
// writes a DataAccessLog row the patient can see in their own Privacy
// Center, exactly as if a category-scoped API route had been called.
export default async function ProviderPatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "PROVIDER") redirect("/portal");

  const { patientId } = await params;

  const consent = await db.consent.findFirst({
    where: {
      patientId,
      recipientUserId: user.id,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (!consent) notFound();

  const profile = await db.patientProfile.findUnique({
    where: { id: patientId },
    select: { fullName: true, dateOfBirth: true, biologicalSex: true, bloodType: true, county: true },
  });
  if (!profile) notFound();

  await writeDataAccessLog({
    patientId,
    actorUserId: user.id,
    actorLabel: user.name,
    consentId: consent.id,
    resourceType: "PatientProfile",
    action: "VIEW",
    purpose: consent.purpose,
    result: "ALLOWED",
  });

  const age = ageFromDateOfBirth(profile.dateOfBirth);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-5">
        <Logo />
        <SignOutButton />
      </header>
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to patients
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.fullName}</h1>
            <p className="mt-1 text-sm text-muted">
              {[age !== null ? `${age} years old` : null, formatBiologicalSex(profile.biologicalSex), profile.county]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {profile.bloodType !== "UNKNOWN" && (
            <Badge tone="danger">{profile.bloodType.replace("_POS", "+").replace("_NEG", "-")}</Badge>
          )}
        </div>

        <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface-alt px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">Access granted for:</span> {consent.purpose}
          </p>
          <p className="text-xs text-muted-2 mt-1">
            {consent.expiresAt ? `Expires ${formatDate(consent.expiresAt)}` : "No expiry (until revoked)"} · Every
            record you view or add here is logged in this patient&apos;s access history.
          </p>
        </div>

        <div className="mt-6">
          <ProviderPatientRecordView patientId={patientId} dataScopes={consent.dataScopes} />
        </div>
      </main>
    </div>
  );
}

function ageFromDateOfBirth(dob: Date): number | null {
  if (!dob) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function formatBiologicalSex(sex: string): string | null {
  if (sex === "UNSPECIFIED") return null;
  return sex.charAt(0) + sex.slice(1).toLowerCase();
}
