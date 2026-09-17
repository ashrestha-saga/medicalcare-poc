import type { LogChannel } from "@/store/logStore";

/** Tailwind classes for activity-log channel chips. */
export const LOG_CHANNEL_CLASS: Record<LogChannel, string> = {
  scan: "text-accent",
  resolve: "text-accent",
  request: "text-ok",
  queue: "text-warn",
  auth: "text-ink-muted",
  error: "text-danger",
  info: "text-ink-muted",
};
