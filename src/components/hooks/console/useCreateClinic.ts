"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CreateClinicInput, CreateClinicResult } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { createClinicSchema } from "@/schemas/console";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";

const EMPTY: CreateClinicInput = {
  name: "",
  street: "",
  postalCode: "",
  city: "",
  country: "DE",
  tenantCode: "",
  siteName: "",
  validFrom: "",
  billingRef: "",
  operatingModel: "provider_operated",
  scope: ["inventory", "due-dates"],
};

export function useCreateClinic() {
  const t = useTranslations("console");
  const router = useRouter();
  const [form, setForm] = useState<CreateClinicInput>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function patch<K extends keyof CreateClinicInput>(key: K, value: CreateClinicInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleScope(token: string) {
    setForm((prev) => {
      const has = prev.scope.includes(token);
      return { ...prev, scope: has ? prev.scope.filter((s) => s !== token) : [...prev.scope, token] };
    });
  }

  async function submit() {
    setBusy(true);
    setFieldErrors({});
    const parsed = createClinicSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setBusy(false);
      return;
    }
    try {
      await api<CreateClinicResult>("/api/partner/clinics", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success(t("created"));
      router.push("/partner/customers");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  return { form, patch, toggleScope, fieldErrors, busy, submit };
}
