import type { UserRole } from "@/interfaces/session";

/** Slim user row for picklists (not full admin user admin). */
export interface UserOptionDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

/** Filter params for reusable user option queries. */
export interface UserOptionsQuery {
  /** Restrict to one or more roles (e.g. ["device_admin"]). */
  roles?: UserRole[];
  /** Default true when omitted. Pass false to include inactive, or null for both. */
  active?: boolean | null;
  /** Name / email search. */
  q?: string;
  /** Exclude specific user ids. */
  excludeIds?: string[];
}
