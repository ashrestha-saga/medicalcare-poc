import type { OxidTokenSet } from "@/interfaces/external";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type TenantOxidPublicStatus = {
  configured: boolean;
  status: "disconnected" | "connected" | "error";
  customerNumber: string | null;
  companyName: string | null;
  shopBaseUrl: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

function toPublic(row: {
  status: string;
  customerNumber: string | null;
  companyName: string | null;
  shopBaseUrl: string | null;
  connectedAt: Date | null;
  lastError: string | null;
} | null): TenantOxidPublicStatus {
  const configured = Boolean(process.env.OXID_CLIENT_ID && process.env.OXID_AUTHORIZE_URL && process.env.OXID_TOKEN_URL);
  if (!row) {
    return {
      configured,
      status: "disconnected",
      customerNumber: null,
      companyName: null,
      shopBaseUrl: null,
      connectedAt: null,
      lastError: null,
    };
  }
  return {
    configured,
    status: row.status === "connected" || row.status === "error" ? row.status : "disconnected",
    customerNumber: row.customerNumber,
    companyName: row.companyName,
    shopBaseUrl: row.shopBaseUrl,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export const tenantOxidService = {
  async getPublicStatus(tenantId: string): Promise<TenantOxidPublicStatus> {
    const row = await prisma.tenantOxidConnection.findUnique({ where: { tenantId } });
    return toPublic(row);
  },

  async getTokens(tenantId: string): Promise<OxidTokenSet | null> {
    const row = await prisma.tenantOxidConnection.findUnique({ where: { tenantId } });
    if (!row?.accessToken || row.status !== "connected") return null;
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken ?? undefined,
      expiresAt: row.expiresAt?.getTime() ?? 0,
      tokenType: "Bearer",
    };
  },

  async saveConnection(input: {
    tenantId: string;
    connectedByUserId: string;
    tokens: OxidTokenSet;
    customerNumber?: string | null;
    companyName?: string | null;
    shopBaseUrl?: string | null;
  }): Promise<TenantOxidPublicStatus> {
    const row = await prisma.tenantOxidConnection.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        accessToken: input.tokens.accessToken,
        refreshToken: input.tokens.refreshToken ?? null,
        expiresAt: input.tokens.expiresAt ? new Date(input.tokens.expiresAt) : null,
        customerNumber: input.customerNumber ?? null,
        companyName: input.companyName ?? null,
        shopBaseUrl: input.shopBaseUrl ?? null,
        status: "connected",
        lastError: null,
        connectedAt: new Date(),
        connectedByUserId: input.connectedByUserId,
      },
      update: {
        accessToken: input.tokens.accessToken,
        refreshToken: input.tokens.refreshToken ?? null,
        expiresAt: input.tokens.expiresAt ? new Date(input.tokens.expiresAt) : null,
        customerNumber: input.customerNumber ?? null,
        companyName: input.companyName ?? null,
        shopBaseUrl: input.shopBaseUrl ?? null,
        status: "connected",
        lastError: null,
        connectedAt: new Date(),
        connectedByUserId: input.connectedByUserId,
      },
    });
    logger.info("oxid.tenant.connected", { tenantId: input.tenantId, by: input.connectedByUserId });
    return toPublic(row);
  },

  async updateTokens(tenantId: string, tokens: OxidTokenSet): Promise<void> {
    await prisma.tenantOxidConnection.update({
      where: { tenantId },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
        status: "connected",
        lastError: null,
      },
    });
  },

  async disconnect(tenantId: string): Promise<TenantOxidPublicStatus> {
    const existing = await prisma.tenantOxidConnection.findUnique({ where: { tenantId } });
    if (!existing) return toPublic(null);
    const row = await prisma.tenantOxidConnection.update({
      where: { tenantId },
      data: {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        status: "disconnected",
        lastError: null,
        connectedAt: null,
        connectedByUserId: null,
      },
    });
    logger.info("oxid.tenant.disconnected", { tenantId });
    return toPublic(row);
  },

  async markError(tenantId: string, message: string): Promise<void> {
    await prisma.tenantOxidConnection.updateMany({
      where: { tenantId },
      data: { status: "error", lastError: message.slice(0, 500) },
    });
  },
};
