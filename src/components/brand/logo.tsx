import { cn } from "@/lib/utils";

// A simple pulse/leaf mark — deliberately not a literal cross or stethoscope
// (avoids "government portal" / clinical-billing visual cliches per the
// brand direction in docs/ux/design-system.md).
export function Logo({ className, mark = true, wordmark = true }: { className?: string; mark?: boolean; wordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {mark && (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="13" stroke="var(--primary)" strokeWidth="1.5" />
          <path
            d="M6 14.5h3.2l1.8-5 2.6 9 2-5.2h2.2"
            stroke="var(--primary)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {wordmark && <span className="text-lg font-semibold tracking-tight text-foreground">Hafya</span>}
    </span>
  );
}
