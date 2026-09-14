"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { api } from "@/lib/api-client";
import { EmailVerificationBanner } from "./email-verification-banner";

export interface ShellUser {
  name: string;
  role: string;
  email: string | null;
  emailVerified: boolean;
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <DesktopSidebar user={user} />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar user={user} />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8 max-w-6xl w-full mx-auto">
          {!user.emailVerified && <EmailVerificationBanner email={user.email} />}
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: (typeof NAV_ITEMS)[number]["icon"] }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary-tint text-primary" : "text-muted hover:bg-surface-alt hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

function DesktopSidebar({ user }: { user: ShellUser }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-5">
      <Link href="/dashboard" className="px-2 mb-6">
        <Logo />
      </Link>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
      <div className="border-t border-border pt-4 px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted capitalize">{user.role.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ user }: { user: ShellUser }) {
  const router = useRouter();

  async function handleSignOut() {
    await api.post("/api/v1/auth/signout");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6 lg:px-8 md:hidden">
      <Link href="/dashboard"><Logo mark wordmark={false} /></Link>
      <div className="flex items-center gap-3">
        <Link href="/privacy" className="text-muted hover:text-foreground" aria-label="Privacy Center">
          <ShieldCheck className="size-5" />
        </Link>
        <button onClick={handleSignOut} className="text-muted hover:text-foreground" aria-label="Sign out" title={user.email ?? undefined}>
          <LogOut className="size-5" />
        </button>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const items = NAV_ITEMS.filter((i) => i.inBottomNav);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <MobileNavLink key={item.href} {...item} />
        ))}
      </div>
    </nav>
  );
}

function MobileNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: (typeof NAV_ITEMS)[number]["icon"] }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted")}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );
}
