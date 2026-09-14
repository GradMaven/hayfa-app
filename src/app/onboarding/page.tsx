import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "PATIENT") redirect("/dashboard");
  if (user.patientProfileId) redirect("/dashboard");

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 sm:px-6 py-5">
        <Logo />
      </header>
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-semibold tracking-tight">Create your health profile</h1>
          <p className="mt-1.5 text-sm text-muted">
            Just enough to get started — you can add more later. See our Privacy Center for how this is used.
          </p>
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
