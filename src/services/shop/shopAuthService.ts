import { createHash } from "node:crypto";
import { runWithTenantAsync } from "@/lib/auth/tenantStore";
import { randomToken } from "@/lib/crypto";
import { downstreamUnavailable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { shopConnectionService } from "@/services/shop/shopConnectionService";
import { getShopProvider } from "@/services/shop/shopRegistry";
import type { ShopSession } from "@/services/shop/types";

const REFRESH_SKEW_MS = 60_000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const refreshLocks = new Map<string, Promise<string | null>>();

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomToken(48);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export const shopAuthService = {
  async beginConnect(input: {
    tenantId: string;
    adminUserId: string;
    returnTo?: string;
  }): Promise<string> {
    const cfg = await shopConnectionService.getConfig(input.tenantId);
    if (!cfg) throw downstreamUnavailable("Shop connection is not configured for this tenant.");
    const provider = getShopProvider(await shopConnectionService.getProviderType(input.tenantId));
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = randomToken(24);
    const returnTo = input.returnTo?.startsWith("/") ? input.returnTo : "/settings";
    await prisma.shopOAuthState.create({
      data: {
        state,
        codeVerifier,
        tenantId: input.tenantId,
        adminUserId: input.adminUserId,
        returnTo,
        expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
      },
    });
    return provider.auth.buildAuthorizeUrl(cfg, { state, codeChallenge });
  },

  async completeConnect(input: { code: string; state: string }): Promise<{ returnTo: string; tenantId: string }> {
    // ShopOAuthState is tenant-guard excluded; TenantShopConnection is not — bind tenant from state.
    const pending = await prisma.shopOAuthState.findUnique({ where: { state: input.state } });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      throw new Error("Unknown or expired authorization state");
    }
    await prisma.shopOAuthState.delete({ where: { id: pending.id } }).catch(() => undefined);

    return runWithTenantAsync(pending.tenantId, async () => {
      const cfg = await shopConnectionService.getConfig(pending.tenantId);
      if (!cfg) throw downstreamUnavailable("Shop connection is not configured for this tenant.");
      const provider = getShopProvider(await shopConnectionService.getProviderType(pending.tenantId));
      const tokens = await provider.auth.exchangeCode(cfg, {
        code: input.code,
        codeVerifier: pending.codeVerifier,
      });
      const account = await provider.auth.fetchAccount({ config: cfg, accessToken: tokens.accessToken });
      await shopConnectionService.saveConnected({
        tenantId: pending.tenantId,
        connectedByUserId: pending.adminUserId,
        tokens,
        customerNumber: account.customerNumber ?? null,
        companyName: account.companyName ?? null,
        hasSubUsers: account.hasSubUsers,
        shopBaseUrl: cfg.shopBaseUrl,
      });
      logger.info("shop.tenant_connect.completed", {
        tenantId: pending.tenantId,
        adminUserId: pending.adminUserId,
        hasSubUsers: account.hasSubUsers,
      });
      return { returnTo: pending.returnTo, tenantId: pending.tenantId };
    });
  },

  async getSession(tenantId: string): Promise<ShopSession | null> {
    const cfg = await shopConnectionService.getConfig(tenantId);
    if (!cfg) return null;
    const token = await this.getAccessTokenForTenant(tenantId);
    if (!token) return null;
    return { config: cfg, accessToken: token };
  },

  async getAccessTokenForTenant(tenantId: string): Promise<string | null> {
    const existing = refreshLocks.get(tenantId);
    if (existing) return existing;

    const run = this.refreshIfNeeded(tenantId).finally(() => {
      refreshLocks.delete(tenantId);
    });
    refreshLocks.set(tenantId, run);
    return run;
  },

  async refreshIfNeeded(tenantId: string): Promise<string | null> {
    const tokens = await shopConnectionService.getTokens(tenantId);
    if (!tokens) return null;
    if (tokens.expiresAt > Date.now() + REFRESH_SKEW_MS) return tokens.accessToken;
    if (!tokens.refreshToken) return tokens.expiresAt > Date.now() ? tokens.accessToken : null;

    const cfg = await shopConnectionService.getConfig(tenantId);
    if (!cfg) return null;
    const provider = getShopProvider(await shopConnectionService.getProviderType(tenantId));
    try {
      const next = await provider.auth.refresh(cfg, tokens.refreshToken);
      if (!next.refreshToken) next.refreshToken = tokens.refreshToken;
      await shopConnectionService.updateTokens(tenantId, next);
      return next.accessToken;
    } catch (error) {
      logger.warn("shop.tenant.refresh_failed", { tenantId, error: String(error) });
      await shopConnectionService.markError(
        tenantId,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  },
};
