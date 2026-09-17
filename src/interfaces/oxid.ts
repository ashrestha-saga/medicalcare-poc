export type OxidLinkStatus = "disconnected" | "connected" | "error";

/** Public OXID shop connection status from GET/DELETE /api/settings/oxid. */
export interface OxidConnectionStatus {
  configured: boolean;
  status: OxidLinkStatus;
  customerNumber: string | null;
  companyName: string | null;
  shopBaseUrl: string | null;
  connectedAt: string | null;
  lastError: string | null;
  canManage: boolean;
}

export interface OxidAuthorizeResponse {
  authorizeUrl: string;
}
