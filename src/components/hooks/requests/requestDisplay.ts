import type { RequestStateTone } from "@/interfaces";
import {
  STARTABLE_REQUEST_STATES,
  serviceRequestStateTone,
} from "@/constants/serviceRequest";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

export type { RequestScope, RequestStateTone } from "@/interfaces";
export { STARTABLE_REQUEST_STATES as STARTABLE_STATES };
export {
  SERVICE_REQUEST_STATE_BADGES,
  SERVICE_REQUEST_STATE_LABELS,
  serviceRequestStateBadge,
  serviceRequestStateLabel,
  serviceRequestStateTone,
} from "@/constants/serviceRequest";

/** Prefer `formatDateTime(iso, locale)` from `@/lib/format` for new call sites. */
export function formatWhen(iso: string, locale: AppLocale = "en"): string {
  return formatDateTime(iso, locale);
}

/** @deprecated Prefer `serviceRequestStateTone` from constants. */
export function stateTone(state: string): RequestStateTone {
  return serviceRequestStateTone(state);
}

export function isStartable(state: string): boolean {
  return (STARTABLE_REQUEST_STATES as readonly string[]).includes(state);
}

export function isCompletable(state: string): boolean {
  return state === "in_progress";
}
