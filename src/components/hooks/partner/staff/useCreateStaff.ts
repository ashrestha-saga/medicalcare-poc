"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  ConsoleStaffInviteInput,
  ConsoleStaffListDTO,
  ConsoleStaffSkillDraftInput,
} from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { consoleStaffInviteSchema } from "@/schemas/console";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";

type FormState = {
  name: string;
  jobTitle: string;
  email: string;
  appRole: "admin" | "inspector" | "order";
  validFrom: string;
  dispatchOrigin: "home" | "partner_site" | "organisation";
  originPostalCode: string;
  originCity: string;
  radiusKm: string;
  skills: ConsoleStaffSkillDraftInput[];
};

const EMPTY: FormState = {
  name: "",
  jobTitle: "",
  email: "",
  appRole: "inspector",
  validFrom: new Date().toISOString().slice(0, 10),
  dispatchOrigin: "organisation",
  originPostalCode: "",
  originCity: "",
  radiusKm: "",
  skills: [],
};

export function useCreateStaff() {
  const t = useTranslations("console");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [refs, setRefs] = useState<ConsoleStaffListDTO["refs"] | null>(null);
  const [refsLoading, setRefsLoading] = useState(true);

  const loadRefs = useCallback(async () => {
    setRefsLoading(true);
    try {
      const data = await api<ConsoleStaffListDTO>("/api/partner/staff");
      setRefs(data.refs);
    } catch {
      setRefs({ qualifications: [], skills: [], skillLevels: [] });
    } finally {
      setRefsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function addSkillRow() {
    const firstSkill = refs?.skills[0]?.code ?? "";
    const firstLevel = refs?.skillLevels[0]?.code ?? "eingewiesen";
    setForm((prev) => ({
      ...prev,
      skills: [
        ...prev.skills,
        { skillCode: firstSkill, levelCode: firstLevel, validUntil: null, evidenceRef: null },
      ],
    }));
  }

  function patchSkill(index: number, patchRow: Partial<ConsoleStaffSkillDraftInput>) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === index ? { ...s, ...patchRow } : s)),
    }));
  }

  function removeSkill(index: number) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  }

  async function submit() {
    setBusy(true);
    setFieldErrors({});
    const radius =
      form.radiusKm.trim() === "" ? null : Number.parseInt(form.radiusKm.trim(), 10);
    const payload: ConsoleStaffInviteInput = {
      email: form.email,
      name: form.name.trim() || null,
      appRole: form.appRole,
      jobTitle: form.jobTitle.trim() || null,
      validFrom: form.validFrom || null,
      dispatchOrigin: form.dispatchOrigin,
      originPostalCode: form.originPostalCode.trim() || null,
      originCity: form.originCity.trim() || null,
      radiusKm: Number.isFinite(radius as number) ? radius : null,
      skills: form.skills.filter((s) => s.skillCode && s.levelCode),
    };
    const parsed = consoleStaffInviteSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setBusy(false);
      return;
    }
    try {
      const res = await api<{ invite: { redeemUrl: string; emailSimulated: boolean } }>(
        "/api/partner/staff",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      toast.success(
        res.invite.emailSimulated
          ? t("staffInviteSimulated", { url: res.invite.redeemUrl })
          : t("staffInvited"),
      );
      router.push("/partner/staff");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffInviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return {
    form,
    patch,
    fieldErrors,
    busy,
    submit,
    refs,
    refsLoading,
    loadRefs,
    addSkillRow,
    patchSkill,
    removeSkill,
  };
}
