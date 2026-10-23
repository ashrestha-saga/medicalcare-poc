import type { ReactNode } from "react";
import { ListPageShell } from "@/components/features/shared/ListPageShell";

/**
 * Standard capability/path deny for clinic admin + partner list pages.
 * Prefer this over ad-hoc ListPageShell + muted paragraph.
 */
export function AccessDenied({
  title,
  description,
  hint,
  testId,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Supporting copy or recovery link. */
  hint?: ReactNode;
  testId: string;
}) {
  return (
    <div className="p-work" data-testid={testId}>
      <main className="p-main">
        <ListPageShell title={title} description={description}>
          {hint ? (
            <div className="text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
              {hint}
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
