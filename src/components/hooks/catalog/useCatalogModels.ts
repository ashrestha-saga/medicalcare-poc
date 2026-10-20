"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CatalogModelDetailDTO,
  CatalogModelImportResult,
  CatalogModelListItemDTO,
  CatalogModelWriteDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

function buildListQuery(opts: { q: string; missingClassification: boolean }): string {
  const sp = new URLSearchParams();
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  if (opts.missingClassification) sp.set("missingClassification", "1");
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useCatalogModels() {
  const t = useTranslations("pages.catalog");
  const { checkPermission } = usePermissions();
  const canView = checkPermission("catalog:view");
  const canUpdate = checkPermission("catalog:update");
  const { sync } = useSyncQueryParams();

  const qParam = useQueryParam("q");
  const missingParam = useQueryParam("missingClassification");
  const missingClassification = missingParam === "1" || missingParam === "true";

  const [models, setModels] = useState<CatalogModelListItemDTO[]>([]);
  const [q, setQState] = useState(qParam ?? "");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CatalogModelDetailDTO | CatalogModelListItemDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setQState(qParam ?? "");
  }, [qParam]);

  const setQ = useCallback(
    (value: string) => {
      setQState(value);
      sync({ q: value.trim() || null });
    },
    [sync],
  );

  const setMissingClassification = useCallback(
    (value: boolean) => {
      sync({ missingClassification: value ? "1" : null });
    },
    [sync],
  );

  const refresh = useCallback(
    async (override?: { q?: string; missingClassification?: boolean }) => {
      if (!canView) {
        setModels([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const qs = buildListQuery({
          q: override?.q ?? q,
          missingClassification:
            override?.missingClassification !== undefined
              ? override.missingClassification
              : missingClassification,
        });
        const res = await api<{ models: CatalogModelListItemDTO[] }>(`/api/catalog/models${qs}`);
        setModels(res.models);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("toastLoadCatalogFailed"));
        setModels([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, q, missingClassification, t],
  );

  useEffect(() => {
    void refresh({
      q: qParam ?? "",
      missingClassification: missingParam === "1" || missingParam === "true",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when URL filters change
  }, [canView, qParam, missingParam]);

  const selectModelById = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${id}`);
        setSelected(res.model);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("toastLoadModelFailed"));
        setSelected(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  const selectModel = useCallback(
    async (model: CatalogModelListItemDTO) => {
      setSelected(model);
      await selectModelById(model.id);
    },
    [selectModelById],
  );

  const applyUpdated = useCallback((model: CatalogModelDetailDTO) => {
    setSelected(model);
    setModels((prev) => prev.map((m) => (m.id === model.id ? model : m)));
  }, []);

  const create = useCallback(
    async (input: CatalogModelWriteDTO) => {
      const res = await api<{ model: CatalogModelListItemDTO }>("/api/catalog/models", {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success(t("toastModelCreated"));
      await refresh();
      return res.model;
    },
    [refresh, t],
  );

  const update = useCallback(
    async (id: string, input: CatalogModelWriteDTO) => {
      const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      toast.success(t("toastModelUpdated"));
      applyUpdated(res.model);
      return res.model;
    },
    [applyUpdated, t],
  );

  const importFile = useCallback(
    async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ result: CatalogModelImportResult }>("/api/catalog/models/import", {
        method: "POST",
        body,
      });
      const { created, updated, skipped } = res.result;
      toast.success(t("toastImportFinished", { created, updated, skipped }));
      await refresh();
      return res.result;
    },
    [refresh, t],
  );

  return {
    models,
    q,
    setQ,
    missingClassification,
    setMissingClassification,
    loading,
    refresh,
    create,
    update,
    importFile,
    canView,
    canUpdate,
    selected,
    selectModel,
    selectModelById,
    clearSelection: () => setSelected(null),
    detailLoading,
    applyUpdated,
  };
}
