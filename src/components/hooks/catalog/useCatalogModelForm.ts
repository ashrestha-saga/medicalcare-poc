"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { CatalogModelFormState, CatalogModelWriteDTO } from "@/interfaces";
import { ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

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

export function toCatalogModelWriteDTO(form: CatalogModelFormState): CatalogModelWriteDTO {
  return {
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
  };
}

/** Local state for the create-model dialog only. */
export function useCatalogModelForm({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CatalogModelWriteDTO) => Promise<void>;
}) {
  const [form, setForm] = useState<CatalogModelFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
  }, [open]);

  const setField = useCallback(<K extends keyof CatalogModelFormState>(key: K, value: CatalogModelFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        await onSubmit(toCatalogModelWriteDTO(form));
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Save failed.");
      } finally {
        setSaving(false);
      }
    },
    [form, onOpenChange, onSubmit],
  );

  return { form, saving, setField, handleSubmit };
}
