import type { HTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const toneConfig: Record<Tone, { classes: string; Icon: typeof Info }> = {
  info: { classes: "bg-info-tint text-info", Icon: Info },
  success: { classes: "bg-success-tint text-success", Icon: CheckCircle2 },
  warning: { classes: "bg-warning-tint text-warning", Icon: AlertTriangle },
  danger: { classes: "bg-danger-tint text-danger", Icon: ShieldAlert },
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  title?: string;
}

export function Alert({ className, tone = "info", title, children, ...props }: AlertProps) {
  const { classes, Icon } = toneConfig[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-[var(--radius-md)] p-4 text-sm", classes, className)}
      {...props}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-1 opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}
