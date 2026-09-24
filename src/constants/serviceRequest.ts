import type { RequestStateTone, ServiceRequestState } from "@/interfaces";

/** States that appear in the technician open queue. */
export const OPEN_REQUEST_STATES = [
  "captured",
  "queued",
  "transmitted",
  "acknowledged",
  "in_progress",
] as const satisfies readonly ServiceRequestState[];

/** States from which work can be started (`in_progress`). */
export const STARTABLE_REQUEST_STATES = [
  "captured",
  "queued",
  "transmitted",
  "acknowledged",
] as const satisfies readonly ServiceRequestState[];

/** Display labels for list / detail / timeline. */
export const SERVICE_REQUEST_STATE_LABELS: Record<string, string> = {
  captured: "Captured",
  queued: "Queued",
  transmitted: "Transmitted",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Rejected",
};

/** Badge variants available on `<Badge />`. */
export type ServiceRequestStateBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

export type ServiceRequestStateBadgeConfig = {
  tone: RequestStateTone;
  variant: ServiceRequestStateBadgeVariant;
  /** Extra Tailwind classes for distinct state colours. */
  className?: string;
  /** Hex for filter chips / legends. */
  colorCode: string;
};

/**
 * Per-state tag colours — reuse in list, detail, filters, history.
 * Tone drives coarse grouping; variant + className drive the chip look.
 */
export const SERVICE_REQUEST_STATE_BADGES: Record<string, ServiceRequestStateBadgeConfig> = {
  captured: {
    tone: "open",
    variant: "outline",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    colorCode: "#0ea5e9",
  },
  queued: {
    tone: "open",
    variant: "secondary",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    colorCode: "#64748b",
  },
  transmitted: {
    tone: "open",
    variant: "default",
    className: "border-transparent bg-primary/15 text-primary",
    colorCode: "#1e7fe0",
  },
  acknowledged: {
    tone: "open",
    variant: "outline",
    className: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    colorCode: "#8b5cf6",
  },
  in_progress: {
    tone: "work",
    variant: "warning",
    colorCode: "#f5a524",
  },
  completed: {
    tone: "done",
    variant: "success",
    colorCode: "#2fd98a",
  },
  rejected: {
    tone: "other",
    variant: "destructive",
    colorCode: "#ff3366",
  },
};

const FALLBACK_BADGE: ServiceRequestStateBadgeConfig = {
  tone: "other",
  variant: "secondary",
  colorCode: "#93a6b4",
};

export function serviceRequestStateLabel(state: string): string {
  return SERVICE_REQUEST_STATE_LABELS[state] ?? state;
}

export function serviceRequestStateTone(state: string): RequestStateTone {
  return SERVICE_REQUEST_STATE_BADGES[state]?.tone ?? FALLBACK_BADGE.tone;
}

export function serviceRequestStateBadge(state: string): ServiceRequestStateBadgeConfig & {
  label: string;
} {
  const cfg = SERVICE_REQUEST_STATE_BADGES[state] ?? FALLBACK_BADGE;
  return { ...cfg, label: serviceRequestStateLabel(state) };
}

/** Filter / dropdown options derived from the badge map. */
export const SERVICE_REQUEST_STATE_FILTER_OPTIONS = Object.keys(SERVICE_REQUEST_STATE_BADGES).map(
  (value) => ({
    value,
    label: serviceRequestStateLabel(value),
    colorCode: SERVICE_REQUEST_STATE_BADGES[value]!.colorCode,
  }),
);
