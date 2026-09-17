import type { ServiceRequestState } from "@/interfaces";

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

/** German labels for the success / timeline UI. */
export const SERVICE_REQUEST_STATE_LABELS: Record<string, string> = {
  captured: "Erfasst",
  queued: "Lokal gespeichert",
  transmitted: "Übermittelt",
  acknowledged: "Vom Partner bestätigt",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
  rejected: "Abgelehnt",
};
