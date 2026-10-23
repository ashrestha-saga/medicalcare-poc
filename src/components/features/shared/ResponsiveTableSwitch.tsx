import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Phase 3.2 B — wide admin lists: table from `md` up, stacked cards below.
 * Prefer hand-rolled / DataTable for desktop; cards for phone/tablet portrait.
 */
export function ResponsiveTableSwitch({
  table,
  cards,
  className,
}: {
  table: ReactNode;
  cards: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <div className="hidden md:block">{table}</div>
      <div className="space-y-3 md:hidden">{cards}</div>
    </div>
  );
}

/** Compact mobile row card for admin lists. */
export function AdminListCard({
  title,
  subtitle,
  children,
  actions,
  testId,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <article
      className={cn("rounded-lg border border-border bg-card p-3 shadow-none", className)}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-col items-end gap-1">{actions}</div> : null}
      </div>
      {children ? <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">{children}</div> : null}
    </article>
  );
}
