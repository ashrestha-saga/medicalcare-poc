import type { ActorContext } from "@/interfaces/audit";
import type { ShopConnectionStatus, ShopProviderType } from "@/interfaces/shop";
import { decryptSecretOrPlain, encryptSecret } from "@/lib/crypto/secretBox";
import { env } from "@/lib/env";
import { unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { assertSafeShopBaseUrl } from "@/lib/shop/shopUrl";
import { DEFAULT_SHOP_SCOPE, type UpsertShopConnectionInput } from "@/schemas/shop";
import { recordAudit } from "@/services/audit/auditService";
import type { ShopConfig, ShopTokens } from "@/services/shop/types";

function enc(value: string | undefined | null): string | null {
  if (!value) return null;
  return encryptSecret(value);
}

function dec(value: string | null | undefined): string | null {
  if (!value) return null;
  return decryptSecretOrPlain(value);
}

function parseConfigJson(raw: string | null | undefined): { paymentId?: string; deliverySetId?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      paymentId: typeof parsed.paymentId === "string" ? parsed.paymentId : undefined,
      deliverySetId: typeof parsed.deliverySetId === "string" ? parsed.deliverySetId : undefined,
    };
  } catch {
    return {};
  }
}

function toPublic(
  row: {
    provider: string;
    status: string;
    shopBaseUrl: string | null;
    clientId: string | null;
    clientSecretEnc: string | null;
    scope: string | null;
    customerNumber: string | null;
    companyName: string | null;
    hasSubUsers: boolean;
    connectedAt: Date | null;
    lastError: string | null;
  } | null,
  canManage: boolean,
): ShopConnectionStatus {
  const hasRowConfig = Boolean(row?.shopBaseUrl && row?.clientId && row?.clientSecretEnc);
  const hasEnvFallback = Boolean(env.oxid.clientId && env.oxid.clientSecret && (env.oxid.apiBaseUrl || env.oxid.authorizeUrl));
  return {
    configured: hasRowConfig || hasEnvFallback,
    provider: (row?.provider as ShopProviderType) ?? null,
    status:
      row?.status === "connected" || row?.status === "error"
        ? row.status
        : "disconnected",
    shopBaseUrl: row?.shopBaseUrl ?? env.oxid.apiBaseUrl ?? null,
    clientId: row?.clientId ?? (env.oxid.clientId || null),
    hasClientSecret: Boolean(row?.clientSecretEnc || env.oxid.clientSecret),
    scope: row?.scope ?? env.oxid.scope ?? DEFAULT_SHOP_SCOPE,
    customerNumber: row?.customerNumber ?? null,
    companyName: row?.companyName ?? null,
    hasSubUsers: row?.hasSubUsers ?? false,
    connectedAt: row?.connectedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    canManage,
  };
}

export const shopConnectionService = {
  async getPublicStatus(tenantId: string, canManage = false): Promise<ShopConnectionStatus> {
    const row = await prisma.tenantShopConnection.findUnique({ where: { tenantId } });
    return toPublic(row, canManage);
  },

  async upsertConfig(tenantId: string, input: UpsertShopConnectionInput, actor: ActorContext): Promise<ShopConnectionStatus> {
    const shopBaseUrl = assertSafeShopBaseUrl(input.shopBaseUrl);
    const existing = await prisma.tenantShopConnection.findUnique({ where: { tenantId } });
    if (!input.clientSecret && !existing?.clientSecretEnc && !env.oxid.clientSecret) {
      throw unprocessable("Client secret is required.", { field: "clientSecret" });
    }
    const scope = input.scope?.trim() || DEFAULT_SHOP_SCOPE;
    const configJson = input.configJson ? JSON.stringify(input.configJson) : existing?.configJson ?? null;
    const wasConnected = existing?.status === "connected";
    const row = await prisma.tenantShopConnection.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: input.provider,
        shopBaseUrl,
        clientId: input.clientId,
        clientSecretEnc: enc(input.clientSecret)!,
        scope,
        configJson,
        status: "disconnected",
      },
      update: {
        provider: input.provider,
        shopBaseUrl,
        clientId: input.clientId,
        ...(input.clientSecret ? { clientSecretEnc: enc(input.clientSecret) } : {}),
        scope,
        configJson,
        // New credentials invalidate the linked session — force reconnect.
        accessTokenEnc: null,
        refreshTokenEnc: null,
        expiresAt: null,
        status: "disconnected",
        connectedAt: null,
        connectedByUserId: null,
        hasSubUsers: false,
        lastError: null,
        submitLeaseUntil: null,
        submitLeaseBy: null,
      },
    });
    await recordAudit({
      actor,
      resource: "oxid",
      resourceId: tenantId,
      action: "update",
      summary: wasConnected
        ? "Updated shop connection settings and disconnected (reconnect required)"
        : "Updated shop connection settings",
      after: { provider: input.provider, shopBaseUrl, clientId: input.clientId, status: "disconnected" },
    });
    return toPublic(row, true);
  },

  async getConfig(tenantId: string): Promise<ShopConfig | null> {
    const row = await prisma.tenantShopConnection.findUnique({ where: { tenantId } });
    const shopBaseUrl = row?.shopBaseUrl || env.oxid.apiBaseUrl || null;
    const clientId = row?.clientId || env.oxid.clientId || null;
    const clientSecret = dec(row?.clientSecretEnc) || env.oxid.clientSecret || null;
    if (!shopBaseUrl || !clientId || !clientSecret) return null;
    const cfg = parseConfigJson(row?.configJson);
    return {
      shopBaseUrl: shopBaseUrl.replace(/\/$/, ""),
      clientId,
      clientSecret,
      scope: row?.scope || env.oxid.scope || DEFAULT_SHOP_SCOPE,
      redirectUri: env.oxid.redirectUri,
      paymentId: cfg.paymentId ?? null,
      deliverySetId: cfg.deliverySetId ?? null,
    };
  },

  async getProviderType(tenantId: string): Promise<"oxid" | "mock"> {
    const row = await prisma.tenantShopConnection.findUnique({
      where: { tenantId },
      select: { provider: true },
    });
    if (row?.provider === "mock") return "mock";
    if (env.oxid.adapterMode === "mock" && !row?.provider) return "mock";
    return "oxid";
  },

  async getTokens(tenantId: string): Promise<ShopTokens | null> {
    const row = await prisma.tenantShopConnection.findUnique({ where: { tenantId } });
    const access = dec(row?.accessTokenEnc);
    if (!access || row?.status !== "connected") return null;
    return {
      accessToken: access,
      refreshToken: dec(row.refreshTokenEnc) ?? undefined,
      expiresAt: row.expiresAt?.getTime() ?? 0,
      tokenType: "Bearer",
    };
  },

  async saveConnected(input: {
    tenantId: string;
    connectedByUserId: string;
    tokens: ShopTokens;
    customerNumber?: string | null;
    companyName?: string | null;
    hasSubUsers?: boolean;
    shopBaseUrl?: string | null;
  }): Promise<ShopConnectionStatus> {
    const row = await prisma.tenantShopConnection.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        accessTokenEnc: enc(input.tokens.accessToken),
        refreshTokenEnc: enc(input.tokens.refreshToken ?? null),
        expiresAt: input.tokens.expiresAt ? new Date(input.tokens.expiresAt) : null,
        customerNumber: input.customerNumber ?? null,
        companyName: input.companyName ?? null,
        hasSubUsers: input.hasSubUsers ?? false,
        shopBaseUrl: input.shopBaseUrl ?? null,
        clientId: env.oxid.clientId || null,
        clientSecretEnc: env.oxid.clientSecret ? enc(env.oxid.clientSecret) : null,
        scope: env.oxid.scope || DEFAULT_SHOP_SCOPE,
        status: "connected",
        connectedAt: new Date(),
        connectedByUserId: input.connectedByUserId,
        lastError: null,
      },
      update: {
        accessTokenEnc: enc(input.tokens.accessToken),
        refreshTokenEnc: enc(input.tokens.refreshToken ?? null),
        expiresAt: input.tokens.expiresAt ? new Date(input.tokens.expiresAt) : null,
        customerNumber: input.customerNumber ?? null,
        companyName: input.companyName ?? null,
        hasSubUsers: input.hasSubUsers ?? false,
        ...(input.shopBaseUrl ? { shopBaseUrl: input.shopBaseUrl } : {}),
        status: "connected",
        connectedAt: new Date(),
        connectedByUserId: input.connectedByUserId,
        lastError: null,
      },
    });
    logger.info("shop.tenant.connected", { tenantId: input.tenantId, by: input.connectedByUserId });
    return toPublic(row, true);
  },

  async updateTokens(tenantId: string, tokens: ShopTokens): Promise<void> {
    await prisma.tenantShopConnection.update({
      where: { tenantId },
      data: {
        accessTokenEnc: enc(tokens.accessToken),
        refreshTokenEnc: enc(tokens.refreshToken ?? null),
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
        status: "connected",
        lastError: null,
      },
    });
  },

  async updateHasSubUsers(tenantId: string, hasSubUsers: boolean): Promise<void> {
    await prisma.tenantShopConnection.updateMany({
      where: { tenantId },
      data: { hasSubUsers },
    });
  },

  async disconnect(tenantId: string, actor?: ActorContext): Promise<ShopConnectionStatus> {
    const existing = await prisma.tenantShopConnection.findUnique({ where: { tenantId } });
    if (!existing) return toPublic(null, true);
    const row = await prisma.tenantShopConnection.update({
      where: { tenantId },
      data: {
        accessTokenEnc: null,
        refreshTokenEnc: null,
        expiresAt: null,
        status: "disconnected",
        lastError: null,
        connectedAt: null,
        connectedByUserId: null,
        hasSubUsers: false,
        submitLeaseUntil: null,
        submitLeaseBy: null,
      },
    });
    await recordAudit({
      actor: actor ?? {
        tenantId,
        actorUserId: existing.connectedByUserId,
        actorKind: "clinic",
        actorRole: null,
        actorName: existing.connectedByUserId ?? "clinic",
        organisationId: null,
        organisationName: null,
        serviceContractId: null,
        correlationId: null,
        ip: null,
        userAgent: null,
      },
      resource: "oxid",
      resourceId: tenantId,
      action: "disconnect",
      summary: "Disconnected shop",
    });
    return toPublic(row, true);
  },

  async markError(tenantId: string, message: string): Promise<void> {
    await prisma.tenantShopConnection.updateMany({
      where: { tenantId },
      data: { status: "error", lastError: message.slice(0, 500) },
    });
  },

  async tryAcquireSubmitLease(tenantId: string, leaseBy: string, ttlMs = 60_000): Promise<boolean> {
    const now = new Date();
    const until = new Date(now.getTime() + ttlMs);
    const result = await prisma.tenantShopConnection.updateMany({
      where: {
        tenantId,
        OR: [{ submitLeaseUntil: null }, { submitLeaseUntil: { lt: now } }, { submitLeaseBy: leaseBy }],
      },
      data: { submitLeaseUntil: until, submitLeaseBy: leaseBy },
    });
    return result.count > 0;
  },

  async releaseSubmitLease(tenantId: string, leaseBy: string): Promise<void> {
    await prisma.tenantShopConnection.updateMany({
      where: { tenantId, submitLeaseBy: leaseBy },
      data: { submitLeaseUntil: null, submitLeaseBy: null },
    });
  },
};
