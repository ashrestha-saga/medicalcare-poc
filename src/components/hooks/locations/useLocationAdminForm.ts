"use client";

import { useCallback, useState } from "react";
import type { SiteDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { createSiteSchema, updateSiteSchema } from "@/schemas/site";
import { zodFieldErrors } from "@/schemas/formErrors";
import { invalidateSites } from "@/components/hooks/location/useSites";
import { toast } from "@/store/toastStore";

export type LocationFormMode = "create" | "edit";

export function useLocationAdminForm(onSaved: () => void) {
  const [mode, setMode] = useState<LocationFormMode>("create");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [areaNames, setAreaNames] = useState<string[]>([]);
  const [areaDraft, setAreaDraft] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setFieldErrors({});
    setBusy(false);
    setAreaDraft("");
  }, []);

  const openCreate = useCallback(() => {
    setMode("create");
    setEditing(null);
    setName("");
    setCode("");
    setAddress("");
    setDeliveryAddress("");
    setAreaNames([]);
    setAreaDraft("");
    setFieldErrors({});
    setOpen(true);
  }, []);

  const openEdit = useCallback((site: SiteDTO) => {
    setMode("edit");
    setEditing(site);
    setName(site.name);
    setCode(site.code ?? "");
    setAddress(site.address ?? "");
    setDeliveryAddress(site.deliveryAddress ?? "");
    setAreaNames(site.areas.map((a) => a.name));
    setAreaDraft("");
    setFieldErrors({});
    setOpen(true);
  }, []);

  const addArea = useCallback(() => {
    const next = areaDraft.trim();
    if (!next) return;
    setAreaNames((prev) => (prev.some((n) => n.toLowerCase() === next.toLowerCase()) ? prev : [...prev, next]));
    setAreaDraft("");
  }, [areaDraft]);

  const removeArea = useCallback((nameToRemove: string) => {
    setAreaNames((prev) => prev.filter((n) => n !== nameToRemove));
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setFieldErrors({});
    try {
      const payload = {
        name,
        code: code.trim() || null,
        address: address.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        areaNames,
      };
      if (mode === "create") {
        const parsed = createSiteSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }
        await api("/api/sites", { method: "POST", body: JSON.stringify(parsed.data) });
        toast.success("Location created.");
      } else if (editing) {
        const parsed = updateSiteSchema.safeParse(payload);
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }
        await api(`/api/sites/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Location updated.");
      }
      invalidateSites();
      close();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [mode, name, code, address, deliveryAddress, areaNames, editing, close, onSaved]);

  return {
    open,
    mode,
    editing,
    busy,
    fieldErrors,
    name,
    setName,
    code,
    setCode,
    address,
    setAddress,
    deliveryAddress,
    setDeliveryAddress,
    areaNames,
    areaDraft,
    setAreaDraft,
    addArea,
    removeArea,
    openCreate,
    openEdit,
    close,
    submit,
  };
}
