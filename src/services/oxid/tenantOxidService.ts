import type { ActorContext } from "@/interfaces/audit";
import type { OxidTokenSet } from "@/interfaces/external";
import { shopConnectionService } from "@/services/shop/shopConnectionService";

export type TenantOxidPublicStatus = {
  configured: boolean;
  status: "disconnected" | "connected" | "error";
  customerNumber: string | null;
  companyName: string | null;
  shopBaseUrl: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

/**
 * Thin shim over shopConnectionService for legacy OXID callers.
 * Prefer `shopConnectionService` for new code.
 */
export const tenantOxidService = {
  async getPublicStatus(tenantId: string): Promise<TenantOxidPublicStatus> {
    const s = await shopConnectionService.getPublicStatus(tenantId);
    return {
      configured: s.configured,
      status: s.status,
      customerNumber: s.customerNumber,
      companyName: s.companyName,
      shopBaseUrl: s.shopBaseUrl,
      connectedAt: s.connectedAt,
      lastError: s.lastError,
    };
  },

  async getTokens(tenantId: string): Promise<OxidTokenSet | null> {
    const tokens = await shopConnectionService.getTokens(tenantId);
    if (!tokens) return null;
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
    };
  },

  async saveConnection(input: {
    tenantId: string;
    connectedByUserId: string;
    tokens: OxidTokenSet;
    customerNumber?: string | null;
    companyName?: string | null;
    shopBaseUrl?: string | null;
  }) {
    return shopConnectionService.saveConnected({
      tenantId: input.tenantId,
      connectedByUserId: input.connectedByUserId,
      tokens: {
        accessToken: input.tokens.accessToken,
        refreshToken: input.tokens.refreshToken,
        expiresAt: input.tokens.expiresAt,
        scope: input.tokens.scope,
        tokenType: input.tokens.tokenType,
      },
      customerNumber: input.customerNumber,
      companyName: input.companyName,
      shopBaseUrl: input.shopBaseUrl,
    });
  },

  async updateTokens(tenantId: string, tokens: OxidTokenSet) {
    await shopConnectionService.updateTokens(tenantId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
    });
  },

  async disconnect(tenantId: string, actor?: ActorContext) {
    return shopConnectionService.disconnect(tenantId, actor);
  },

  async markError(tenantId: string, message: string) {
    await shopConnectionService.markError(tenantId, message);
  },
};
