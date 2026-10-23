import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Quiet empty copy for list/board bodies (admin + console). */
export function EmptyState({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} data-testid={testId}>
      {children}
    </p>
  );
}
