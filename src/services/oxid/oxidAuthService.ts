import { createHash } from "node:crypto";
import type { OxidMeProfile, OxidTokenSet } from "@/interfaces/external";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { oxidEndpoint } from "@/lib/oxid/url";
import { pendingAuthorizations } from "@/lib/tokenStorage";
import { profileCompany, profileUserId } from "@/services/oxid/oxidProfile";
import { tenantOxidService } from "@/services/oxid/tenantOxidService";

/**
 * OAuth 2.0 Authorization Code + PKCE for **tenant shop linking** (Settings).
 * DeviceCare login is email/password — not OXID.
 */

const REFRESH_SKEW_MS = 60_000;

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomToken(48);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

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

async function postToken(body: URLSearchParams): Promise<OxidTokenSet> {
  if (env.oxid.clientSecret) body.set("client_secret", env.oxid.clientSecret);
  const { data } = await fetchJson<Record<string, unknown>>(env.oxid.tokenUrl, {
    method: "POST",
    timeoutMs: 8000,
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  return mapTokenResponse(data);
}

export const oxidAuthService = {
  isConfigured(): boolean {
    return env.oxid.configured;
  },

  /** Admin Settings — start OAuth to link one OXID shop to the tenant. */
  beginTenantConnect(input: { tenantId: string; adminUserId: string; returnTo?: string }): string {
    if (!env.oxid.configured) throw new Error("OXID OAuth2 is not configured");
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = randomToken(24);
    pendingAuthorizations.put(state, {
      codeVerifier,
      createdAt: Date.now(),
      returnTo: input.returnTo?.startsWith("/") ? input.returnTo : "/settings",
      purpose: "tenant_connect",
      tenantId: input.tenantId,
      adminUserId: input.adminUserId,
    });
    return buildAuthorizeUrl({
      authorizeUrl: env.oxid.authorizeUrl,
      clientId: env.oxid.clientId,
      redirectUri: env.oxid.redirectUri,
      state,
      codeChallenge,
      scope: env.oxid.scope,
    });
  },

  async completeTenantConnect(input: { code: string; state: string }): Promise<{ returnTo: string; tenantId: string }> {
    const pendingAuth = pendingAuthorizations.take(input.state);
    if (!pendingAuth || pendingAuth.purpose !== "tenant_connect") {
      throw new Error("Unknown or expired authorization state");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: env.oxid.redirectUri,
      client_id: env.oxid.clientId,
      code_verifier: pendingAuth.codeVerifier,
    });
    const tokens = await postToken(body);
    const profile = await this.fetchProfile(tokens.accessToken);
    await tenantOxidService.saveConnection({
      tenantId: pendingAuth.tenantId,
      connectedByUserId: pendingAuth.adminUserId,
      tokens,
      customerNumber: profile.custnr?.trim() || null,
      companyName: profileCompany(profile),
      shopBaseUrl: env.oxid.apiBaseUrl || null,
    });
    logger.info("oxid.tenant_connect.completed", {
      tenantId: pendingAuth.tenantId,
      adminUserId: pendingAuth.adminUserId,
      oxidUser: profileUserId(profile),
    });
    return { returnTo: pendingAuth.returnTo, tenantId: pendingAuth.tenantId };
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

  /** Access token for the tenant's linked shop account. */
  async getAccessTokenForTenant(tenantId: string): Promise<string | null> {
    const t = await tenantOxidService.getTokens(tenantId);
    if (!t) return null;
    if (t.expiresAt > Date.now() + REFRESH_SKEW_MS) return t.accessToken;
    if (!t.refreshToken) return t.expiresAt > Date.now() ? t.accessToken : null;
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: t.refreshToken,
        client_id: env.oxid.clientId,
      });
      const next = await postToken(body);
      if (!next.refreshToken) next.refreshToken = t.refreshToken;
      await tenantOxidService.updateTokens(tenantId, next);
      return next.accessToken;
    } catch (error) {
      logger.warn("oxid.tenant.refresh_failed", { tenantId, error: String(error) });
      await tenantOxidService.markError(tenantId, error instanceof Error ? error.message : String(error));
      return null;
    }
  },
};
