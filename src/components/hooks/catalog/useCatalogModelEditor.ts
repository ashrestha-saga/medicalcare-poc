"use client";

import { useCallback, useState } from "react";
import type {
  CatalogModelDetailDTO,
  CatalogModelFormState,
  CatalogModelListItemDTO,
  CatalogModelWriteDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { softwareClassFromFlags } from "./catalogDisplay";

function emptyForm(): CatalogModelFormState {
  return {
    tradeName: "",
    modelName: "",
    manufacturer: "",
    manufacturerSrn: "",
    basicUdiDi: "",
    udiDi: "",
    gtins: "",
    riskClass: "",
    emdnCode: "",
    gmdnCode: "",
    source: "manual",
    state: "draft",
  };
}

/** Full-page edit for a catalog model (inventory-style, not a modal). */
export function useCatalogModelEditor(onSaved: (model: CatalogModelDetailDTO) => void) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CatalogModelDetailDTO | null>(null);
  const [form, setForm] = useState<CatalogModelFormState>(emptyForm);
  const [annex1, setAnnex1] = useState(false);
  const [annex2, setAnnex2] = useState(false);
  const [softwareIIb, setSoftwareIIb] = useState(false);
  const [softwareC, setSoftwareC] = useState(false);
  const [radiation, setRadiation] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setDetail(null);
    setBusy(false);
  }, []);

  const hydrate = useCallback((model: CatalogModelDetailDTO) => {
    setDetail(model);
    setForm({
      tradeName: model.tradeName ?? "",
      modelName: model.modelName ?? "",
      manufacturer: model.manufacturer ?? "",
      manufacturerSrn: model.manufacturerSrn ?? "",
      basicUdiDi: model.basicUdiDi ?? "",
      udiDi: model.udiDi ?? "",
      gtins: model.gtins.join(", "),
      riskClass: model.riskClass ?? "",
      emdnCode: model.emdnCode ?? "",
      gmdnCode: model.gmdnCode ?? "",
      source: model.source,
      state: model.state,
    });
    const sw = model.classification?.softwareClass?.toUpperCase() ?? "";
    setAnnex1(Boolean(model.classification?.annex1));
    setAnnex2(Boolean(model.classification?.annex2));
    setSoftwareIIb(sw === "IIB");
    setSoftwareC(sw === "C");
    setRadiation(Boolean(model.classification?.radiation));
  }, []);

  const openEdit = useCallback(
    async (model: CatalogModelListItemDTO) => {
      setOpen(true);
      setLoading(true);
      try {
        const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${model.id}`);
        hydrate(res.model);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load model.");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [hydrate],
  );

  const setField = useCallback(<K extends keyof CatalogModelFormState>(key: K, value: CatalogModelFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setSoftwareClass = useCallback((value: string) => {
    const upper = value.toUpperCase();
    if (upper === "IIB") {
      setSoftwareIIb(true);
      setSoftwareC(false);
    } else if (upper === "C") {
      setSoftwareC(true);
      setSoftwareIIb(false);
    } else {
      setSoftwareIIb(false);
      setSoftwareC(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const body: CatalogModelWriteDTO = {
        tradeName: form.tradeName.trim() || null,
        modelName: form.modelName.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        manufacturerSrn: form.manufacturerSrn.trim() || null,
        basicUdiDi: form.basicUdiDi.trim() || null,
        udiDi: form.udiDi.trim() || null,
        gtins: form.gtins
          .split(/[,;|]/)
          .map((g) => g.trim())
          .filter(Boolean),
        riskClass: form.riskClass.trim() || null,
        emdnCode: form.emdnCode.trim() || null,
        gmdnCode: form.gmdnCode.trim() || null,
        source: form.source,
        state: form.state,
        classification: {
          annex1,
          annex2,
          softwareClass: softwareClassFromFlags(softwareIIb, softwareC),
          radiation,
        },
      };
      const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Model updated.");
      hydrate(res.model);
      onSaved(res.model);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [annex1, annex2, detail, form, hydrate, onSaved, radiation, softwareC, softwareIIb]);

  return {
    open,
    busy,
    loading,
    detail,
    close,
    openEdit,
    submit,
    setField,
    form,
    annex1,
    annex2,
    softwareClass: softwareClassFromFlags(softwareIIb, softwareC) ?? "",
    radiation,
    setAnnex1,
    setAnnex2,
    setSoftwareClass,
    setRadiation,
    softwareIIb,
    softwareC,
    setSoftwareIIb,
    setSoftwareC,
  };
}
