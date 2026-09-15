import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminNav } from "../admin-nav";
import { AdminUsers } from "./admin-users";

export default async function AdminUsersPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <AdminNav />
        <p className="mt-4 text-sm text-muted">
          Account administration only — this never shows or touches clinical data. Suspending or deactivating an
          account signs it out everywhere immediately and blocks sign-in until reactivated.
        </p>
        <AdminUsers currentUserId={user.id} />
      </main>
    </div>
  );
}
