import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminProviderQueue } from "./admin-provider-queue";

// SUPER_ADMIN-only. Deliberately its own minimal shell (not the (app)
// sidebar, not /portal's) — an admin is neither a patient nor a
// provider/caregiver, and this surface is scoped narrowly to provider
// verification only (see docs/admin-architecture.md), not a general admin
// dashboard.
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "SUPER_ADMIN") redirect("/signin");

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-5">
        <Logo />
        <SignOutButton />
      </header>
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Provider verification</h1>
        <p className="mt-1.5 text-sm text-muted">
          Review self-registered provider accounts before they can receive patient consent grants. Every decision is
          logged and the provider is notified either way.
        </p>
        <AdminProviderQueue />
      </main>
    </div>
  );
}
