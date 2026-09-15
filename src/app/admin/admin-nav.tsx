"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Provider verification" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/users", label: "Users" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div role="tablist" aria-label="Admin sections" className="flex gap-1 border-b border-border mb-2 overflow-x-auto">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          role="tab"
          aria-selected={pathname === link.href}
          className={cn(
            "shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            pathname === link.href ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
