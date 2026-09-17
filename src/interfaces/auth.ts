import type { ReactNode } from "react";
import type { SessionUser } from "./session";

export interface LoginResponse {
  user: Omit<SessionUser, "tenantId">;
  tenantName: string;
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
}
