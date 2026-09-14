import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PortalOverview } from "./portal-overview";

export default async function PortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role === "PATIENT") redirect("/dashboard");

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
            ? "The full provider portal — clinical notes, prescriptions, care plans — is coming in a later phase. For now, here are the patients who have granted you access."
            : "The full caregiver view is coming in a later phase. For now, here's who has added you as a caregiver, and what you're authorized to see."}
        </p>
        <PortalOverview role={user.role} />
      </main>
    </div>
  );
}
