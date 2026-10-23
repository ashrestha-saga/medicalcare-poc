import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Optional data-field key for tests / scroll-to-error. */
  fieldKey?: string;
}

/**
 * Admin/console form field: muted eyebrow label + control + hint/error.
 * Use on clinic admin + partner screens; field BEM flows keep `.p-field`.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  fieldKey,
}: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)} data-field={fieldKey}>
      <Label
        htmlFor={htmlFor}
        required={required}
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {aside}
    </div>
  );
}
