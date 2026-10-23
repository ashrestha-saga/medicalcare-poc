import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ListPageShellVariant = "list" | "board" | "compose";

/**
 * Catalog-style list page: padded work area + bordered Card around title + body.
 * - list: default admin tables/filters
 * - board: dashboard-style zones (slightly tighter title)
 * - compose: form-first pages (primary actions belong in headerExtra)
 */
export function ListPageShell({
  title,
  description,
  headerExtra,
  children,
  className,
  contentClassName,
  testId,
  variant = "list",
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Optional alert, filters summary, or action row under the title. */
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  testId?: string;
  variant?: ListPageShellVariant;
}) {
  const titleClass =
    variant === "board" ? "text-xl sm:text-2xl" : variant === "compose" ? "text-xl" : "text-2xl";

  return (
    <div className={cn("px-4 pb-6 pt-4 sm:px-[18px]", className)} data-testid={testId}>
      <Card className="border-border bg-card">
        <CardHeader className={cn("gap-4", variant === "compose" && "pb-3")}>
          <div>
            <CardTitle className={titleClass}>{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1.5 max-w-[78ch]">{description}</CardDescription>
            ) : null}
          </div>
          {headerExtra}
        </CardHeader>
        <CardContent className={cn(contentClassName)}>{children}</CardContent>
      </Card>
    </div>
  );
}
