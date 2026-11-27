/** E107 / RD46 — person inbox ("Für mich"). */

export type NotificationKind =
  | "due_reminder"
  | "deviation"
  | "approval_order"
  | "approval_quote"
  | "assignment"
  | "follow_up"
  | "recall"
  | "import_review"
  | "report_received"
  | "lock"
  | "provisional_review";

export type NotificationState = "unread" | "read" | "done";

export interface NotificationTarget {
  /** e.g. device | request | import_job | inspection_run */
  type: string;
  id: string;
  /** Human inventory / asset number when type=device (clinic search). */
  inventoryNumber?: string;
  /** Clinic tenant for partner deep links (my-sites). */
  tenantId?: string;
  /** Optional UI focus: reports | duties | klaerliste */
  focus?: string;
}

export interface UserNotificationDTO {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  target: NotificationTarget | null;
  /** Resolved in-app link for the target, when known. */
  href: string | null;
  state: NotificationState;
  createdAt: string;
  readAt: string | null;
  doneAt: string | null;
}

export type NotificationMailMode = "off" | "daily";

export interface NotificationPreferencesDTO {
  mail: NotificationMailMode;
}

export interface NotificationListDTO {
  notifications: UserNotificationDTO[];
  unreadCount: number;
  preferences: NotificationPreferencesDTO;
}

export interface NotificationDigestResultDTO {
  users: number;
  notifications: number;
  mailed: number;
  skipped: number;
}
