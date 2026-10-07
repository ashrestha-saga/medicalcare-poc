"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  CatalogDetailProps,
  CatalogModelDetailDTO,
  CatalogModelListItemDTO,
} from "@/interfaces";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info } from "lucide-react";
import {
  catalogClassificationOptions,
  catalogGmdnEmdn,
  catalogShortId,
  catalogSourceLabel,
} from "@/components/hooks/catalog/catalogDisplay";
import { catalogStateBadge } from "@/components/hooks/catalog/useCatalogColumns";
import { intlLocale, type AppLocale } from "@/lib/locale";

function isDetail(model: CatalogModelDetailDTO | CatalogModelListItemDTO): model is CatalogModelDetailDTO {
  return "spread" in model && "createdAt" in model;
}

function FieldBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function formatWhen(iso: string, locale: AppLocale): string {
  try {
    return new Date(iso).toLocaleString(intlLocale(locale), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CatalogDetail({ model, canEdit, onBack, onEdit }: CatalogDetailProps) {
  const t = useTranslations("catalogDetail");
  const tCommon = useTranslations("common");
  const tClass = useTranslations("classificationOptions");
  const locale = useLocale() as AppLocale;
  const detail = isDetail(model) ? model : null;
  const status = catalogStateBadge(model.state);
  const meta = [catalogShortId(model.id), model.manufacturer, `v${model.version}`].filter(Boolean).join(" · ");
  const options = catalogClassificationOptions(model.classification, tClass);
  const spread = detail?.spread ?? [];
  const dash = tCommon("dash");

  return (
    <div className="px-4 pb-8 sm:px-[18px]" data-testid="catalog-detail">
      <section className="mb-4">
        <p className="text-xs text-muted-foreground">{t("eyebrowModel")}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t("pageHeadline")}</h2>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-xl" data-testid="catalog-detail-title">
                  {model.displayName}
                </CardTitle>
                <CardDescription>{meta}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                {canEdit && onEdit && (
                  <Button type="button" size="sm" className="h-8" onClick={onEdit} data-testid="catalog-edit-open">
                    {t("edit")}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={onBack}>
                  {t("back")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <FieldBox label={t("basicUdiDi")} value={model.basicUdiDi ?? dash} />
              <FieldBox
                label={t("gtin")}
                value={
                  [model.udiDi, ...model.gtins]
                    .map((v) => v?.trim())
                    .filter((v): v is string => Boolean(v))
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(", ") || dash
                }
              />
              <FieldBox label={t("gmdnEmdn")} value={catalogGmdnEmdn(model, dash)} />
              <FieldBox label={t("manufacturer")} value={model.manufacturer ?? dash} />
              <FieldBox label={t("dataSource")} value={catalogSourceLabel(model.source, t)} />
              <FieldBox
                label={t("maintenanceCycle")}
                value={
                  model.maintenanceCycleMonths != null
                    ? t("months", { count: model.maintenanceCycleMonths })
                    : dash
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base lowercase">{tClass("sectionTitle")}</CardTitle>
              <CardDescription>{tClass("sectionDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
              {model.classification?.confidence ? (
                <p className="text-xs text-muted-foreground">
                  {t("confidence", {
                    value: String(model.classification.confidence).toUpperCase(),
                  })}
                  {model.classification.source ? ` · ${model.classification.source}` : ""}
                </p>
              ) : null}
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertTitle>{tClass("changeAlertTitle")}</AlertTitle>
                <AlertDescription>
                  {tClass("changeAlertBody", {
                    copies: model.copyCount,
                    sites: model.siteCount,
                  })}
                </AlertDescription>
              </Alert>
              {canEdit ? (
                <Button asChild type="button" size="sm" className="h-8" data-testid="catalog-classification-edit">
                  <Link href={`/registration/reclassify/${model.id}`}>{tClass("editClassification")}</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{t("compatibleProducts")}</CardTitle>
                <CardDescription>{t("zeroAssignments")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("compatibleProductsEmpty")}
              </p>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base lowercase">{t("spread")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {spread.length ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t("client")}</TableHead>
                      <TableHead className="text-right">{t("copies")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spread.map((row) => (
                      <TableRow key={row.siteId}>
                        <TableCell>
                          <div className="font-medium">{row.siteName}</div>
                          <div className="text-xs text-muted-foreground">{row.siteId.slice(0, 10)}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.copyCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-6 pb-6 text-sm text-muted-foreground">{t("noInventoryCopies")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("documents")}</CardTitle>
              <CardDescription>{t("zeroCentral")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("documentsEmpty")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("versions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">v{model.version}</p>
                  <Badge variant="success">{t("activeBadge")}</Badge>
                </div>
                {detail && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("updatedAt", { when: formatWhen(detail.updatedAt, locale) })}
                    <br />
                    {t("createdAt", { when: formatWhen(detail.createdAt, locale) })}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("versionHistoryNote")}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
