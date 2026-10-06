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
  contactName: "",
  contactEmail: "",
  mpsbName: "",
  validFrom: "",
  billingRef: "",
  avvRef: "",
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
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function toggleScope(token: string) {
    setForm((prev) => {
      const has = prev.scope.includes(token);
      return { ...prev, scope: has ? prev.scope.filter((s) => s !== token) : [...prev.scope, token] };
    });
    setFieldErrors((prev) => {
      if (!prev.scope) return prev;
      const next = { ...prev };
      delete next.scope;
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setFieldErrors({});
    const parsed = createClinicSchema.safeParse(form);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setBusy(false);
      const first = Object.keys(errors)[0];
      if (first) {
        requestAnimationFrame(() => {
          document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({
            block: "center",
            behavior: "smooth",
          });
        });
      }
      return;
    }
    try {
      const result = await api<CreateClinicResult>("/api/partner/clinics", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (result.invite.emailSimulated) {
        toast.success(t("createdInviteSimulated", { email: result.invite.email }));
      } else {
        toast.success(t("createdInvite", { email: result.invite.email }));
      }
      router.push("/partner/customers");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  return { form, patch, toggleScope, fieldErrors, busy, submit };
}
