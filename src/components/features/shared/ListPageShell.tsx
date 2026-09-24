import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Catalog-style list page: padded work area + bordered Card around title + body.
 * Use for admin list modules (inventory, requests, training overview, …).
 */
export function ListPageShell({
  title,
  description,
  headerExtra,
  children,
  className,
  contentClassName,
  testId,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Optional alert, filters summary, or action row under the title. */
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  testId?: string;
}) {
  return (
    <div className={cn("px-4 pb-6 pt-4 sm:px-[18px]", className)} data-testid={testId}>
      <Card className="border-border bg-card">
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-2xl">{title}</CardTitle>
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
