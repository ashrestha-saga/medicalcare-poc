import type { OxidMeProfile, OxidTokenSet } from "@/interfaces/external";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import { oxidEndpoint } from "@/lib/oxid/url";
import { shopAuthService, generatePkcePair } from "@/services/shop/shopAuthService";

/**
 * Thin shim — shop OAuth lives in `shopAuthService`. Kept for legacy imports
 * (dispatch / token route / tests) until Phase 6 cleanup.
 */

export { generatePkcePair };

export function buildAuthorizeUrl(params: {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
}): string {
  const url = new URL(params.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scope);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function mapTokenResponse(raw: Record<string, unknown>): OxidTokenSet {
  const accessToken = typeof raw.access_token === "string" ? raw.access_token : "";
  if (!accessToken) throw new Error("Token response missing access_token");
  const expiresIn = typeof raw.expires_in === "number" ? raw.expires_in : 3600;
  return {
    accessToken,
    refreshToken: typeof raw.refresh_token === "string" ? raw.refresh_token : undefined,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: typeof raw.scope === "string" ? raw.scope : undefined,
    tokenType: typeof raw.token_type === "string" ? raw.token_type : "Bearer",
  };
}

function parseMePayload(raw: Record<string, unknown>): OxidMeProfile {
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
  const oxid = typeof data.oxid === "string" ? data.oxid : "";
  const sub = typeof data.sub === "string" ? data.sub : "";
  if (!oxid && !sub) throw new Error("OXID /oauth/me response missing oxid (user id)");
  return { ...(data as unknown as OxidMeProfile), oxid: oxid || sub, sub: sub || undefined };
}

export const oxidAuthService = {
  isConfigured(): boolean {
    return env.oxid.configured;
  },

  /** @deprecated Use shopAuthService.beginConnect (async). */
  beginTenantConnect(input: { tenantId: string; adminUserId: string; returnTo?: string }): string {
    void input;
    throw new Error("Use POST /api/settings/shop/connect — in-memory OXID connect is removed.");
  },

  async completeTenantConnect(input: { code: string; state: string }): Promise<{ returnTo: string; tenantId: string }> {
    return shopAuthService.completeConnect(input);
  },

  async fetchProfile(accessToken: string): Promise<OxidMeProfile> {
    const url = oxidEndpoint("oauthme", "getProfile");
    const { data } = await fetchJson<Record<string, unknown>>(url, {
      method: "GET",
      timeoutMs: 8000,
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
    });
    return parseMePayload(data);
  },

  async getAccessTokenForTenant(tenantId: string): Promise<string | null> {
    return shopAuthService.getAccessTokenForTenant(tenantId);
  },
};
