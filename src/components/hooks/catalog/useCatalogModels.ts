"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CatalogModelDetailDTO,
  CatalogModelImportResult,
  CatalogModelListItemDTO,
  CatalogModelWriteDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useCatalogModels() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("catalog:view");
  const canUpdate = checkPermission("catalog:update");

  const [models, setModels] = useState<CatalogModelListItemDTO[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CatalogModelDetailDTO | CatalogModelListItemDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(
    async (search = q) => {
      if (!canView) {
        setModels([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
        const res = await api<{ models: CatalogModelListItemDTO[] }>(`/api/catalog/models${qs}`);
        setModels(res.models);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load model catalog.");
        setModels([]);
      } finally {
        setLoading(false);
      }
    },
    [canView, q],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / canView change
    void refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount / gate fetch
  }, [canView]);

  const selectModelById = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${id}`);
      setSelected(res.model);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load model.");
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

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
      toast.success("Model created.");
      await refresh();
      return res.model;
    },
    [refresh],
  );

  const update = useCallback(async (id: string, input: CatalogModelWriteDTO) => {
    const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    toast.success("Model updated.");
    applyUpdated(res.model);
    return res.model;
  }, [applyUpdated]);

  const importFile = useCallback(
    async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ result: CatalogModelImportResult }>("/api/catalog/models/import", {
        method: "POST",
        body,
      });
      const { created, updated, skipped } = res.result;
      toast.success(`Import finished: ${created} created, ${updated} updated, ${skipped} skipped.`);
      await refresh();
      return res.result;
    },
    [refresh],
  );

  return {
    models,
    q,
    setQ,
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
