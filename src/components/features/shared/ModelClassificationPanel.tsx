"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CatalogClassificationSummary } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { catalogClassificationOptions } from "@/components/hooks/catalog/catalogDisplay";

export interface ModelClassificationPanelProps {
  classification: CatalogClassificationSummary | null | undefined;
  /** When set, shown under the checklist (inventory copies of this model). */
  instanceCount?: number | null;
  modelId?: string | null;
  canViewCatalog?: boolean;
  /** device_admin / superadmin — `catalog:update`. */
  canEditCatalog?: boolean;
  /** Extra note under the list (e.g. inventarize edit form). */
  footnote?: string | null;
  testId?: string;
}

/**
 * Read-only checklist of model classification flags (same rows as catalog edit).
 * Admins with catalog:update get “Edit in catalog”; others with catalog:view get open-only.
 */
export function ModelClassificationPanel({
  classification,
  instanceCount,
  modelId,
  canViewCatalog = false,
  canEditCatalog = false,
  footnote,
  testId = "model-classification-panel",
}: ModelClassificationPanelProps) {
  const t = useTranslations("classificationOptions");
  const options = catalogClassificationOptions(classification ?? null, t);
  const hasAny = options.some((o) => o.checked) || Boolean(classification?.softwareClass);
  const sw = classification?.softwareClass?.trim() ?? "";
  const swUpper = sw.toUpperCase();
  const swShownInTicks = swUpper === "IIB" || swUpper === "C";

  const editHref = modelId && canEditCatalog ? `/registration/reclassify/${modelId}` : null;
  const viewHref = modelId && canViewCatalog ? `/catalog/${modelId}` : null;

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        {classification?.confidence ? (
          <Badge variant="secondary" className="uppercase">
            {classification.confidence}
          </Badge>
        ) : null}
        {sw && !swShownInTicks ? (
          <Badge variant="outline" className="uppercase">
            SW {sw}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5"
          >
            <Checkbox checked={opt.checked} disabled className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{opt.title}</span>
              <span className="block text-xs text-muted-foreground">{opt.description}</span>
            </span>
          </label>
        ))}
      </div>

      {!hasAny ? <p className="text-xs text-muted-foreground">{t("empty")}</p> : null}

      {instanceCount != null ? (
        <p className="text-xs text-muted-foreground">{t("appliesToCopies", { count: instanceCount })}</p>
      ) : null}

      {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}

      {editHref ? (
        <Button asChild type="button" size="sm" className="mt-1 h-8 w-full">
          <Link href={editHref} data-testid="classification-edit-in-catalog">
            {t("editClassification")}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : viewHref ? (
        <Button asChild type="button" variant="outline" size="sm" className="mt-1 h-8 w-full">
          <Link href={viewHref} data-testid="classification-open-catalog">
            {t("openInCatalog")}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
