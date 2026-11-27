"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ShopArticleDetailResponse, ShopArticleDTO } from "@/interfaces/shop";
import type { SparePartDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Loading";
import { formatMoney } from "@/lib/cart";
import { api, ApiError } from "@/lib/http/apiClient";
import { QtyStepper } from "@/components/features/cart/QtyStepper";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toastStore";

export function toSparePart(article: ShopArticleDTO): SparePartDTO {
  return {
    id: article.id,
    articleNumber: article.articleNumber,
    description: article.variantLabel
      ? `${article.title} (${article.variantLabel})`
      : article.title,
    manufacturer: article.manufacturer,
    unitPrice: article.unitPrice,
    currency: article.currency,
    fitsModelIds: [],
    category: article.kind === "device" ? "device" : article.kind === "suggestion" ? "suggestion" : "accessory",
  };
}

function ArticleThumb({
  src,
  alt,
  emphasize,
}: {
  src: string | null | undefined;
  alt: string;
  emphasize?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-border bg-muted/40",
        emphasize ? "h-20 w-20" : "h-16 w-16",
      )}
      aria-hidden={!showImage}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- OXID host is tenant-configured
        <img
          src={src!}
          alt={alt}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          —
        </div>
      )}
    </div>
  );
}

export function ShopArticleCard({
  article,
  quantity,
  onAdd,
  onQty,
  emphasize,
  onVariantsLoaded,
}: {
  article: ShopArticleDTO;
  quantity: number;
  /** Called with the article (or chosen variant) to put in the cart. */
  onAdd: (toAdd: ShopArticleDTO) => void;
  onQty: (q: number) => void;
  /** Larger treatment for the matched inventory device product. */
  emphasize?: boolean;
  /** Persist lazy-loaded variants on the parent catalog row. */
  onVariantsLoaded?: (articleId: string, variants: ShopArticleDTO[]) => void;
}) {
  const t = useTranslations("pages.shop");
  const cachedVariants = (article.variants ?? []).filter((v) => v.active !== false);
  const variantsKnown = Array.isArray(article.variants);
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [localVariants, setLocalVariants] = useState<ShopArticleDTO[] | null>(null);

  const variants = localVariants ?? cachedVariants;

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const price =
    article.unitPrice != null ? formatMoney(article.unitPrice, article.currency) : t("priceOnRequest");
  const fromPrice =
    article.hasVariants || variants.length > 0
      ? (() => {
          const prices = variants.map((v) => v.unitPrice).filter((p): p is number => p != null);
          if (!prices.length && article.unitPrice != null) return article.unitPrice;
          if (!prices.length) return null;
          return Math.min(...prices);
        })()
      : null;

  const roleLabel =
    article.kind === "device"
      ? t("badgeDevice")
      : article.kind === "suggestion"
        ? t("badgeSuggestion")
        : t("badgeAccessory");

  const closePicker = () => {
    setPicking(false);
    setSelectedId(null);
  };

  const confirmVariant = () => {
    if (!selected) return;
    onAdd(selected);
    closePicker();
  };

  const startAdd = async () => {
    // Device tab lists variants as their own cards — never gate on parent.
    if (article.kind === "device") {
      onAdd(article);
      return;
    }

    // Cached: no children → add this row.
    if (variantsKnown && cachedVariants.length === 0) {
      onAdd(article);
      return;
    }

    // Cached / local variants → picker.
    if (variants.length > 0) {
      setPicking(true);
      return;
    }

    // Leaf article (oxvarcount 0) → add immediately.
    if (article.hasVariants === false) {
      onAdd(article);
      return;
    }

    // Parent (or unknown): fetch detail once on Add, then pick or add.
    setPicking(true);
    setLoadingVariants(true);
    try {
      const res = await api<ShopArticleDetailResponse>(
        `/api/shop/articles/${encodeURIComponent(article.id)}`,
      );
      const active = res.variants.filter((v) => v.active !== false);
      setLocalVariants(active);
      onVariantsLoaded?.(article.id, active);
      if (active.length === 0) {
        onAdd({ ...article, hasVariants: false, variants: [] });
        closePicker();
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("variantLoadFailed"));
      closePicker();
    } finally {
      setLoadingVariants(false);
    }
  };

  const showPicker = picking;
  const showFromPrice = (article.hasVariants || variants.length > 0) && fromPrice != null;

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        emphasize && "border-foreground/20 bg-muted/30",
        showPicker && "border-foreground/30",
      )}
      data-testid={`shop-article-${article.articleNumber}`}
    >
      <div className="flex gap-3 sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <ArticleThumb src={article.imageUrl} alt={article.title} emphasize={emphasize} />
          <div className="min-w-0 flex-1 space-y-1">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.08em]",
                article.kind === "device" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {roleLabel}
            </p>
            <h3 className={cn("text-foreground", emphasize ? "text-lg font-semibold" : "text-sm font-medium")}>
              {article.title}
            </h3>
            {article.shortDescription ? (
              <p className="text-sm text-muted-foreground">{article.shortDescription}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{article.articleNumber}</p>
            <p className={cn("tabular-nums text-foreground", emphasize ? "text-base font-medium" : "text-sm")}>
              {showFromPrice ? t("priceFrom", { price: formatMoney(fromPrice!, article.currency) }) : price}
            </p>
          </div>
        </div>
        <div className="shrink-0 self-start">
          {!article.hasVariants && quantity > 0 && !showPicker ? (
            <QtyStepper value={quantity} onChange={onQty} />
          ) : showPicker ? null : (
            <Button
              type="button"
              variant={emphasize ? "default" : "outline"}
              size="sm"
              onClick={() => void startAdd()}
              data-testid={`shop-add-${article.id}`}
            >
              {article.hasVariants ? t("chooseVariant") : t("add")}
            </Button>
          )}
        </div>
      </div>

      {showPicker ? (
        <div
          className="mt-3 space-y-3 border-t border-border pt-3"
          data-testid={`shop-variant-picker-${article.id}`}
        >
          {loadingVariants ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner />
              {t("loadingVariants")}
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">{t("chooseVariantHint")}</p>
              <div className="space-y-1.5" role="radiogroup" aria-label={t("chooseVariant")}>
                {variants.map((v) => {
                  const checked = selectedId === v.id;
                  const vPrice =
                    v.unitPrice != null ? formatMoney(v.unitPrice, v.currency) : t("priceOnRequest");
                  return (
                    <label
                      key={v.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-foreground bg-muted/40"
                          : "border-border hover:bg-muted/30",
                      )}
                    >
                      <input
                        type="radio"
                        name={`variant-${article.id}`}
                        className="accent-foreground"
                        checked={checked}
                        onChange={() => setSelectedId(v.id)}
                        data-testid={`shop-variant-${v.id}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {v.variantLabel?.trim() || v.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">{v.articleNumber}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{vPrice}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={closePicker}>
                  {t("cancelVariant")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selected}
                  onClick={confirmVariant}
                  data-testid={`shop-confirm-variant-${article.id}`}
                >
                  {t("addVariant")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
