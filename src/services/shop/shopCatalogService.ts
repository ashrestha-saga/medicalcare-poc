import type {
  DeviceShopArticlesResponse,
  DeviceShopCatalogResponse,
  DeviceShopCatalogSectionResponse,
  ShopArticleDetailResponse,
  ShopArticleDTO,
  ShopCatalogSection,
} from "@/interfaces/shop";
import type { TenantWorkContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { downstreamUnavailable, notFound, unprocessable } from "@/lib/errors";
import { isOrderingEnabled } from "@/lib/features/ordering";
import { prisma } from "@/lib/prisma";
import { shopAuthService } from "@/services/shop/shopAuthService";
import { shopConnectionService } from "@/services/shop/shopConnectionService";
import { getShopProvider } from "@/services/shop/shopRegistry";
import { shopProductPictureUrl } from "@/lib/shop/shopUrl";
import type { ShopArticle, ShopArticleDetail, ShopArticleRef, ShopSession } from "@/services/shop/types";
import { recordExternalCall } from "@/services/shared/externalCallLog";

const ENRICH_CHUNK = 20;

function toDto(
  article: ShopArticle,
  kind: ShopArticleDTO["kind"],
  shopBaseUrl?: string | null,
  childVariants?: ShopArticle[],
): ShopArticleDTO {
  const imageUrl =
    article.imageUrl ??
    (shopBaseUrl
      ? shopProductPictureUrl(shopBaseUrl, article.imageFile, article.shopId ?? "1")
      : null);
  const variants = (childVariants ?? [])
    .filter((v) => v.active !== false)
    .map((v) => toDto(v, kind, shopBaseUrl));
  const hasVariants =
    variants.length > 0 || (typeof article.variantCount === "number" && article.variantCount > 0);
  return {
    id: article.id,
    articleNumber: article.articleNumber,
    title: article.title,
    gtin: article.gtin,
    manufacturer: article.manufacturer,
    unitPrice: article.unitPrice,
    currency: article.currency,
    stockLabel: article.stockLabel,
    kind,
    shortDescription: article.shortDescription ?? null,
    variantLabel: article.variantLabel ?? null,
    active: article.active !== false,
    imageUrl,
    hasVariants,
    ...(variants.length ? { variants } : {}),
  };
}

function stubFromRef(ref: ShopArticleRef, kind: ShopArticleDTO["kind"]): ShopArticleDTO {
  return {
    id: ref.id,
    articleNumber: ref.id,
    title: ref.title || ref.id,
    gtin: null,
    manufacturer: null,
    unitPrice: null,
    currency: "EUR",
    stockLabel: null,
    kind,
    shortDescription: null,
    variantLabel: null,
    active: true,
    imageUrl: null,
    hasVariants: false,
  };
}

function parseGtins(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((g): g is string => typeof g === "string" && Boolean(g.trim()));
  } catch {
    /* ignore */
  }
  return raw
    .split(/[\s,;]+/)
    .map((g) => g.trim())
    .filter(Boolean);
}

function deviceLabel(device: {
  inventoryNumber: string;
  model?: { tradeName: string | null; modelName: string | null; manufacturer: string | null } | null;
}): string {
  const name =
    device.model?.tradeName?.trim() ||
    device.model?.modelName?.trim() ||
    device.model?.manufacturer?.trim() ||
    null;
  return name ? `${device.inventoryNumber} · ${name}` : device.inventoryNumber;
}

/** Batch list enrich only — no per-oxid detail (variants load on Add). */
async function enrichByOxids(
  session: ShopSession,
  provider: ReturnType<typeof getShopProvider>,
  refs: ShopArticleRef[],
  kind: ShopArticleDTO["kind"],
  ctx: TenantWorkContext,
): Promise<ShopArticleDTO[]> {
  if (!refs.length) return [];
  const byId = new Map<string, ShopArticle>();
  const ids = [...new Set(refs.map((r) => r.id).filter(Boolean))];
  const shopBaseUrl = session.config.shopBaseUrl;

  for (let i = 0; i < ids.length; i += ENRICH_CHUNK) {
    const chunk = ids.slice(i, i + ENRICH_CHUNK);
    const started = Date.now();
    try {
      const found = await provider.catalog.findArticles(session, "oxid", chunk);
      for (const a of found) byId.set(a.id, a);
      await recordExternalCall({
        system: "oxid",
        operation: "enrichArticles",
        identifier: chunk[0] ?? "chunk",
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        durationMs: Date.now() - started,
        cacheHit: false,
        success: true,
      });
    } catch (error) {
      await recordExternalCall({
        system: "oxid",
        operation: "enrichArticles",
        identifier: chunk[0] ?? "chunk",
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        durationMs: Date.now() - started,
        cacheHit: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return refs.map((ref) => {
    const hit = byId.get(ref.id);
    if (!hit) return stubFromRef(ref, kind);
    return toDto(hit, kind, shopBaseUrl);
  });
}

async function requireOrdering(ctx: TenantWorkContext) {
  requirePermission(ctx, "parts:request");
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  if (!isOrderingEnabled(tenant?.featureFlags)) {
    const { requireOrderingEnabled } = await import("@/lib/features/ordering");
    requireOrderingEnabled(tenant?.featureFlags);
  }
}

type ParentDetailBundle = {
  device: {
    id: string;
    inventoryNumber: string;
    model?: { tradeName: string | null; modelName: string | null; manufacturer: string | null } | null;
  };
  session: ShopSession;
  provider: ReturnType<typeof getShopProvider>;
  detail: ShopArticleDetail | null;
  hasSubUsers: boolean;
};

const PARENT_DETAIL_TTL_MS = 90_000;
const parentDetailCache = new Map<string, { at: number; bundle: Omit<ParentDetailBundle, "session"> & { session?: ShopSession } }>();

async function loadParentDetail(
  deviceInstanceId: string,
  ctx: TenantWorkContext,
): Promise<ParentDetailBundle> {
  await requireOrdering(ctx);

  const cacheKey = `${ctx.tenantId}:${deviceInstanceId}`;
  const cached = parentDetailCache.get(cacheKey);
  const session = await shopAuthService.getSession(ctx.tenantId);
  if (!session) throw downstreamUnavailable("Shop is not connected. Configure it in Settings.");

  if (cached && Date.now() - cached.at < PARENT_DETAIL_TTL_MS) {
    return {
      ...cached.bundle,
      session,
      provider: getShopProvider(await shopConnectionService.getProviderType(ctx.tenantId)),
    };
  }

  const device = await prisma.deviceInstance.findFirst({
    where: { id: deviceInstanceId, tenantId: ctx.tenantId },
    include: { model: true },
  });
  if (!device) throw notFound("Device not found");

  const status = await shopConnectionService.getPublicStatus(ctx.tenantId);
  const provider = getShopProvider(await shopConnectionService.getProviderType(ctx.tenantId));
  const gtins = [
    ...parseGtins(device.model?.gtins ?? null),
    device.model?.udiDi,
    device.udiDi,
  ].filter((g): g is string => Boolean(g));

  const started = Date.now();
  let detail: ShopArticleDetail | null = null;
  try {
    if (gtins.length && provider.catalog.findArticleDetail) {
      detail = await provider.catalog.findArticleDetail(session, "gtin", gtins);
    } else if (gtins.length) {
      const found = await provider.catalog.findArticles(session, "gtin", gtins);
      const first = found[0];
      if (first) {
        detail = {
          ...first,
          shortDescription: first.shortDescription ?? null,
          categories: [],
          variants: [],
          accessoryRefs: [],
          crosssellingRefs: [],
        };
      }
    }
    await recordExternalCall({
      system: "oxid",
      operation: "findArticleDetail",
      identifier: gtins[0] ?? deviceInstanceId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      durationMs: Date.now() - started,
      cacheHit: false,
      success: true,
    });
  } catch (error) {
    await recordExternalCall({
      system: "oxid",
      operation: "findArticleDetail",
      identifier: gtins[0] ?? deviceInstanceId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      durationMs: Date.now() - started,
      cacheHit: false,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    detail = null;
  }

  const bundle = {
    device,
    provider,
    detail,
    hasSubUsers: status.hasSubUsers,
  };
  parentDetailCache.set(cacheKey, { at: Date.now(), bundle });
  return { ...bundle, session };
}

export const shopCatalogService = {
  async getDeviceShopArticles(
    deviceInstanceId: string,
    ctx: TenantWorkContext,
  ): Promise<DeviceShopArticlesResponse> {
    const catalog = await this.getDeviceShopCatalog(deviceInstanceId, ctx);
    const section = await this.getDeviceShopSection(deviceInstanceId, "accessories", ctx);
    return {
      device: catalog.primary,
      accessories: section.items,
      source: catalog.source,
      hasSubUsers: catalog.hasSubUsers,
    };
  },

  /**
   * Device shell only: primary + variants + counts.
   * Accessories / suggestions are empty until getDeviceShopSection.
   */
  async getDeviceShopCatalog(
    deviceInstanceId: string,
    ctx: TenantWorkContext,
  ): Promise<DeviceShopCatalogResponse> {
    const { device, session, detail, hasSubUsers, provider } = await loadParentDetail(deviceInstanceId, ctx);
    const shopBaseUrl = session.config.shopBaseUrl;
    const activeVariants = (detail?.variants ?? []).filter((v) => v.active !== false);

    return {
      deviceInstance: {
        id: device.id,
        inventoryNumber: device.inventoryNumber,
        label: deviceLabel(device),
      },
      primary: detail ? toDto(detail, "device", shopBaseUrl) : null,
      variants: activeVariants.map((v) => toDto(v, "device", shopBaseUrl)),
      accessories: [],
      suggestions: [],
      accessoryCount: detail?.accessoryRefs.length ?? 0,
      suggestionCount: detail?.crosssellingRefs.length ?? 0,
      categories: detail?.categories ?? [],
      source: provider.type,
      hasSubUsers,
    };
  },

  /** Lazy tab load — batch-enrich accessories or suggestions once, client caches. */
  async getDeviceShopSection(
    deviceInstanceId: string,
    section: ShopCatalogSection,
    ctx: TenantWorkContext,
  ): Promise<DeviceShopCatalogSectionResponse> {
    const { session, provider, detail } = await loadParentDetail(deviceInstanceId, ctx);
    if (!detail) return { section, items: [] };

    const kind = section === "accessories" ? "accessory" : "suggestion";
    let refs =
      section === "accessories" ? detail.accessoryRefs : detail.crosssellingRefs;

    let items = await enrichByOxids(session, provider, refs, kind, ctx);

    if (section === "accessories" && items.length === 0 && provider.catalog.findAccessories) {
      try {
        const legacy = await provider.catalog.findAccessories(session, detail.articleNumber);
        const shopBaseUrl = session.config.shopBaseUrl;
        items = legacy.map((a) => toDto(a, "accessory", shopBaseUrl));
      } catch {
        /* ignore */
      }
    }

    return { section, items };
  },

  /** Lazy variant load — one OXID detail call when user clicks Add. */
  async getArticleDetail(oxid: string, ctx: TenantWorkContext): Promise<ShopArticleDetailResponse> {
    await requireOrdering(ctx);
    const id = oxid.trim();
    if (!id) throw unprocessable("Article id is required.", { field: "oxid" });

    const session = await shopAuthService.getSession(ctx.tenantId);
    if (!session) throw downstreamUnavailable("Shop is not connected. Configure it in Settings.");
    const provider = getShopProvider(await shopConnectionService.getProviderType(ctx.tenantId));
    const shopBaseUrl = session.config.shopBaseUrl;

    const started = Date.now();
    let detail: ShopArticleDetail | null = null;
    try {
      if (provider.catalog.findArticleDetail) {
        detail = await provider.catalog.findArticleDetail(session, "oxid", [id]);
      }
      if (!detail) {
        const found = await provider.catalog.findArticles(session, "oxid", [id]);
        const first = found[0];
        if (first) {
          detail = {
            ...first,
            shortDescription: first.shortDescription ?? null,
            categories: [],
            variants: [],
            accessoryRefs: [],
            crosssellingRefs: [],
          };
        }
      }
      await recordExternalCall({
        system: "oxid",
        operation: "articleDetail",
        identifier: id,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        durationMs: Date.now() - started,
        cacheHit: false,
        success: Boolean(detail),
      });
    } catch (error) {
      await recordExternalCall({
        system: "oxid",
        operation: "articleDetail",
        identifier: id,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        durationMs: Date.now() - started,
        cacheHit: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (!detail) throw notFound("Shop article not found");

    const activeVariants = (detail.variants ?? []).filter((v) => v.active !== false);
    const kind: ShopArticleDTO["kind"] = "accessory";
    return {
      article: toDto(detail, kind, shopBaseUrl, activeVariants),
      variants: activeVariants.map((v) => toDto(v, kind, shopBaseUrl)),
    };
  },
};
