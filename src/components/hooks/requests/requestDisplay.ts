import type { RequestStateTone } from "@/interfaces";
import { STARTABLE_REQUEST_STATES } from "@/constants/serviceRequest";

export type { RequestScope, RequestStateTone } from "@/interfaces";
export { STARTABLE_REQUEST_STATES as STARTABLE_STATES };

export function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function stateTone(state: string): RequestStateTone {
  if (state === "in_progress") return "work";
  if (state === "completed") return "done";
  if ((STARTABLE_REQUEST_STATES as readonly string[]).includes(state)) return "open";
  return "other";
}

export function isStartable(state: string): boolean {
  return (STARTABLE_REQUEST_STATES as readonly string[]).includes(state);
}

export function isCompletable(state: string): boolean {
  return state === "in_progress";
}
