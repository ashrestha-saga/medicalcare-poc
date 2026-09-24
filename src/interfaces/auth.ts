import type { ReactNode } from "react";
import type { SessionUser } from "./session";

export interface LoginResponse {
  user: Omit<SessionUser, "tenantId" | "organisationId">;
  tenantName: string;
  /** Where the client should navigate after a successful sign-in. */
  homePath?: string;
}

/** Password OK but TOTP required before session cookie is issued. */
export interface LoginRequires2faResponse {
  requires2fa: true;
  /** Hint only — real challenge is httpOnly cookie. */
  message: string;
}

export type LoginApiResponse = LoginResponse | LoginRequires2faResponse;

export interface TotpStatusDTO {
  enabled: boolean;
  verifiedAt: string | null;
}

export interface TotpSetupStartDTO {
  otpauthUrl: string;
  secret: string;
  qrDataUrl: string;
}

export interface TotpSetupConfirmDTO {
  backupCodes: string[];
}

export interface SignInProps {
  notice?: string | null;
  /** Which login door — clinic (default) or partner organisation. */
  door?: "clinic" | "partner";
}

export interface LockScreenProps {
  onLockedOut: () => void;
  onSignOut: () => void;
}

export interface PinSetupProps {
  onDone: () => void;
}

export interface AuthGateProps {
  children: ReactNode;
  /** Signed-out redirect target. Defaults to /login (clinic door). */
  loginPath?: string;
}
