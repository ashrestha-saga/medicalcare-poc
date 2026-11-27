import type { NotificationKind, NotificationTarget } from "@/interfaces/notifications";

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  "due_reminder",
  "deviation",
  "approval_order",
  "approval_quote",
  "assignment",
  "follow_up",
  "recall",
  "import_review",
  "report_received",
  "lock",
  "provisional_review",
];

/** UserPreference bag coordinates for the mail digest preference. */
export const NOTIFICATION_PREF_SCOPE = "notifications";
export const NOTIFICATION_PREF_MAIL_KEY = "mail";

export const NOTIFICATION_LIST_LIMIT = 100;

/** Stable dedup keys — one open notification per user + topic. */
export const notificationDedup = {
  importFinished: (jobId: string) => `import_review:${jobId}`,
  reportReceived: (runId: string) => `report_received:${runId}`,
  reportAcknowledged: (performanceId: string) => `report_ack:${performanceId}`,
  assignment: (requestId: string) => `assignment:${requestId}`,
  dueReminder: (deviceDutyId: string, stage: string) => `due_reminder:${deviceDutyId}:${stage}`,
  externalPerformance: (performanceId: string) => `report_received:external:${performanceId}`,
  approvalQuote: (serviceRequestId: string) => `approval_quote:${serviceRequestId}`,
  approvalOrder: (proposalId: string) => `approval_order:${proposalId}`,
  recall: (actionId: string) => `recall:${actionId}`,
  deviation: (clarificationId: string) => `deviation:${clarificationId}`,
  lock: (deviceInstanceId: string) => `lock:${deviceInstanceId}`,
} as const;

type HrefOpts = {
  door?: "clinic" | "partner";
  kind?: NotificationKind | string | null;
  /** Fallback tenant from UserNotification.tenantId when target omits it. */
  tenantId?: string | null;
};

/** Deep link for a notification target; null when unknown. */
export function hrefForNotificationTarget(
  target: NotificationTarget | null | undefined,
  doorOrOpts: "clinic" | "partner" | HrefOpts = "clinic",
): string | null {
  const opts: HrefOpts =
    typeof doorOrOpts === "string" ? { door: doorOrOpts } : (doorOrOpts ?? {});
  const door = opts.door ?? "clinic";
  if (!target?.id && target?.type !== "import_job") return null;

  const id = target.id ? encodeURIComponent(target.id) : "";
  const inv = target.inventoryNumber?.trim();
  const tenantId = target.tenantId || opts.tenantId || null;
  const focus = target.focus || focusForKind(opts.kind);

  if (door === "partner") {
    switch (target.type) {
      case "request":
        return id ? `/partner/orders/${id}` : "/partner/orders";
      case "device":
        if (tenantId) {
          const q = inv ? `?q=${encodeURIComponent(inv)}` : "";
          return `/partner/my-sites/${encodeURIComponent(tenantId)}${q}`;
        }
        return "/partner/disposition";
      case "import_job":
        return null;
      default:
        return id ? `/partner/orders/${id}` : "/partner/orders";
    }
  }

  switch (target.type) {
    case "device": {
      const sp = new URLSearchParams();
      if (target.id) sp.set("id", target.id);
      if (inv) sp.set("q", inv);
      if (focus) sp.set("focus", focus);
      const qs = sp.toString();
      return qs ? `/devices?${qs}` : "/devices";
    }
    case "request":
      return id ? `/requests/${id}` : "/requests";
    case "import_job":
      return id
        ? `/devices/import/jobs?job=${id}`
        : "/devices?tab=klaerliste&issue=import_review";
    case "inspection_run":
      // Fall back to device list; run id alone has no clinic page yet.
      return "/devices";
    default:
      return null;
  }
}

function focusForKind(kind: string | null | undefined): string | undefined {
  if (kind === "report_received" || kind === "follow_up") return "reports";
  if (kind === "due_reminder" || kind === "provisional_review" || kind === "import_review") {
    return "duties";
  }
  if (kind === "lock") return "duties";
  return undefined;
}
