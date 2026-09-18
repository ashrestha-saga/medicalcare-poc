"use client";

import type { UserRole } from "@/interfaces";
import { useUserOptions } from "@/components/hooks/users/useUserOptions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export interface UserSelectProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  /** Default: device_admin only. */
  roles?: UserRole[];
  active?: boolean | null;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  id?: string;
  "data-testid"?: string;
  /** When true, wrap with Label (admin forms). Inventarize uses its own label. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Reusable user dropdown backed by /api/users/options.
 * Filter via `roles` / `active` for future picklists.
 */
export function UserSelect({
  value,
  onChange,
  roles = ["device_admin"],
  active = true,
  label = "Responsible person",
  placeholder = "Select user",
  disabled,
  required,
  error,
  id = "user-select",
  "data-testid": testId = "user-select",
  showLabel = true,
  className,
}: UserSelectProps) {
  const { users, loading, error: loadError } = useUserOptions({ roles, active });

  const select = (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || loading}
    >
      <SelectTrigger id={id} data-testid={testId} className={className}>
        <SelectValue placeholder={loading ? "Loading…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
            {u.email ? ` (${u.email})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!showLabel) {
    return (
      <div className="space-y-1">
        {select}
        {(error || loadError) && <p className="p-err text-xs text-destructive">{error || loadError}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {select}
      {(error || loadError) && <p className="text-xs text-destructive">{error || loadError}</p>}
    </div>
  );
}
