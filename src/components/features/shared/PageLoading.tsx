import { Spinner } from "@/components/ui/Loading";
import { cn } from "@/lib/utils";

/** Inline loading row for use inside ListPageShell / cards (not full-viewport). */
export function PageLoading({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2 py-8 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
