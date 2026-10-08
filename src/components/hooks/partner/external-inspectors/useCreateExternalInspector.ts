"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  ConsoleExternalListDTO,
  ConsoleStaffSkillDraftInput,
} from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { consoleExternalInviteSchema } from "@/schemas/console";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";

type FormState = {
  name: string;
  email: string;
  employerOrganisationId: string;
  commissionedFrom: string;
  commissionedTo: string;
  liabilityUntil: string;
  liabilitySumEur: string;
  originPostalCode: string;
  originCity: string;
  radiusKm: string;
  skills: ConsoleStaffSkillDraftInput[];
};

const today = () => new Date().toISOString().slice(0, 10);

export function useCreateExternalInspector() {
  const t = useTranslations("console");
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    employerOrganisationId: "",
    commissionedFrom: today(),
    commissionedTo: "",
    liabilityUntil: "",
    liabilitySumEur: "",
    originPostalCode: "",
    originCity: "",
    radiusKm: "",
    skills: [],
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Pick<ConsoleExternalListDTO, "employerOptions" | "refs"> | null>(
    null,
  );
  const [metaLoading, setMetaLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const data = await api<ConsoleExternalListDTO>("/api/partner/external-inspectors");
      setMeta({ employerOptions: data.employerOptions, refs: data.refs });
      setForm((prev) => ({
        ...prev,
        employerOrganisationId: prev.employerOrganisationId || data.employerOptions[0]?.id || "",
      }));
    } catch {
      setMeta({ employerOptions: [], refs: { qualifications: [], skills: [], skillLevels: [] } });
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

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
    const firstSkill = meta?.refs.skills[0]?.code ?? "";
    const firstLevel = meta?.refs.skillLevels[0]?.code ?? "eingewiesen";
    setForm((prev) => ({
      ...prev,
      skills: [
        ...prev.skills,
        { skillCode: firstSkill, levelCode: firstLevel, validUntil: null, evidenceRef: null },
      ],
    }));
  }

  function patchSkill(index: number, row: Partial<ConsoleStaffSkillDraftInput>) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === index ? { ...s, ...row } : s)),
    }));
  }

  function removeSkill(index: number) {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  }

  async function submit() {
    setBusy(true);
    setFieldErrors({});
    const sumRaw = form.liabilitySumEur.trim();
    const sumEur =
      sumRaw === ""
        ? null
        : Number.parseInt(sumRaw.includes("e6") || sumRaw.includes("Mio") ? "5000000" : sumRaw, 10);
    // Allow "5" meaning 5 Mio → store as 5_000_000 if value < 1000
    let liabilitySumEur: number | null = null;
    if (sumRaw !== "") {
      const n = Number.parseInt(sumRaw.replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n)) liabilitySumEur = n < 1000 ? n * 1_000_000 : n;
    }
    const radius =
      form.radiusKm.trim() === "" ? null : Number.parseInt(form.radiusKm.trim(), 10);
    const payload = {
      email: form.email,
      name: form.name.trim() || null,
      employerOrganisationId: form.employerOrganisationId,
      commissionedFrom: form.commissionedFrom,
      commissionedTo: form.commissionedTo,
      liabilityUntil: form.liabilityUntil,
      liabilitySumEur,
      originPostalCode: form.originPostalCode.trim() || null,
      originCity: form.originCity.trim() || null,
      radiusKm: Number.isFinite(radius as number) ? radius : null,
      skills: form.skills.filter((s) => s.skillCode && s.levelCode),
    };
    void sumEur;
    const parsed = consoleExternalInviteSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setBusy(false);
      return;
    }
    try {
      const res = await api<{ invite: { redeemUrl: string; emailSimulated: boolean } }>(
        "/api/partner/external-inspectors",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      toast.success(
        res.invite.emailSimulated
          ? t("staffInviteSimulated", { url: res.invite.redeemUrl })
          : t("externalInvited"),
      );
      router.push("/partner/external-inspectors");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("externalInviteFailed"));
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
    meta,
    metaLoading,
    loadMeta,
    addSkillRow,
    patchSkill,
    removeSkill,
  };
}
