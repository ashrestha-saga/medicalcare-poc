"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ConsoleExternalListDTO,
  ConsoleStaffMemberDTO,
  ConsoleStaffRefsDTO,
} from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

/** Partner console — external inspector detail, profile, skills, quals. */
export function useExternalInspectorDetail(membershipId: string) {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("console:external:manage");

  const [member, setMember] = useState<ConsoleStaffMemberDTO | null>(null);
  const [employerOptions, setEmployerOptions] = useState<
    ConsoleExternalListDTO["employerOptions"]
  >([]);
  const [refs, setRefs] = useState<ConsoleStaffRefsDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [employerOrganisationId, setEmployerOrganisationId] = useState("");
  const [commissionedFrom, setCommissionedFrom] = useState("");
  const [commissionedTo, setCommissionedTo] = useState("");
  const [liabilityUntil, setLiabilityUntil] = useState("");
  const [liabilitySumEur, setLiabilitySumEur] = useState("");
  const [originPostalCode, setOriginPostalCode] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [radiusKm, setRadiusKm] = useState("");

  const [skillCode, setSkillCode] = useState("");
  const [levelCode, setLevelCode] = useState("");
  const [skillValidUntil, setSkillValidUntil] = useState("");
  const [skillEvidence, setSkillEvidence] = useState("");
  const [qualCode, setQualCode] = useState("");
  const [qualValidUntil, setQualValidUntil] = useState("");
  const [qualEvidence, setQualEvidence] = useState("");

  const applyMember = useCallback((m: ConsoleStaffMemberDTO) => {
    setMember(m);
    setName(m.name);
    setEmployerOrganisationId(m.employerOrganisationId ?? "");
    setCommissionedFrom(m.commissionedFrom ?? "");
    setCommissionedTo(m.commissionedTo ?? "");
    setLiabilityUntil(m.liabilityUntil ?? "");
    setLiabilitySumEur(m.liabilitySumEur != null ? String(m.liabilitySumEur) : "");
    setOriginPostalCode(m.originPostalCode ?? "");
    setOriginCity(m.originCity ?? "");
    setRadiusKm(m.radiusKm != null ? String(m.radiusKm) : "");
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, list] = await Promise.all([
        api<{ member: ConsoleStaffMemberDTO }>(
          `/api/partner/external-inspectors/${encodeURIComponent(membershipId)}`,
        ),
        api<ConsoleExternalListDTO>("/api/partner/external-inspectors"),
      ]);
      applyMember(detail.member);
      setEmployerOptions(list.employerOptions);
      setRefs(list.refs);
      setSkillCode((prev) => prev || list.refs.skills[0]?.code || "");
      setLevelCode((prev) => prev || list.refs.skillLevels[0]?.code || "");
      setQualCode((prev) => prev || list.refs.qualifications[0]?.code || "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("externalLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [membershipId, t, applyMember]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load detail on mount
    void refresh();
  }, [refresh]);

  const isInvited = member?.status === "invited";
  const readOnly = isInvited || !canManage;

  const employerSelectOptions = useMemo(() => {
    const opts = [...employerOptions];
    if (
      member?.employerOrganisationId &&
      !opts.some((o) => o.id === member.employerOrganisationId)
    ) {
      opts.unshift({
        id: member.employerOrganisationId,
        name: member.employerName ?? t("externalUnknownEmployer"),
        code: member.employerCode ?? "",
      });
    }
    return opts;
  }, [employerOptions, member, t]);

  async function saveProfile() {
    setBusy(true);
    try {
      const sumRaw = liabilitySumEur.trim();
      let sum: number | null = null;
      if (sumRaw !== "") {
        const n = Number.parseInt(sumRaw.replace(/[^\d]/g, ""), 10);
        if (Number.isFinite(n)) sum = n < 1000 ? n * 1_000_000 : n;
      }
      const radius = radiusKm.trim() === "" ? null : Number.parseInt(radiusKm.trim(), 10);
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/external-inspectors/${encodeURIComponent(membershipId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            employerOrganisationId: employerOrganisationId || null,
            commissionedFrom,
            commissionedTo,
            liabilityUntil,
            liabilitySumEur: sum,
            originPostalCode: originPostalCode || null,
            originCity: originCity || null,
            radiusKm: Number.isFinite(radius as number) ? radius : null,
          }),
        },
      );
      applyMember(res.member);
      toast.success(t("externalSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("externalSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addSkill() {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/external-inspectors/${encodeURIComponent(membershipId)}/skills`,
        {
          method: "POST",
          body: JSON.stringify({
            skillCode,
            levelCode,
            validUntil: skillValidUntil || null,
            evidenceRef: skillEvidence || null,
          }),
        },
      );
      applyMember(res.member);
      setSkillEvidence("");
      setSkillValidUntil("");
      toast.success(t("staffSkillAdded"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffSkillFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeSkill(skillId: string) {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/external-inspectors/${encodeURIComponent(membershipId)}/skills/${skillId}`,
        { method: "DELETE" },
      );
      applyMember(res.member);
      toast.success(t("staffSkillRemoved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffSkillFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addQualification() {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/external-inspectors/${encodeURIComponent(membershipId)}/qualifications`,
        {
          method: "POST",
          body: JSON.stringify({
            qualificationCode: qualCode,
            validUntil: qualValidUntil || null,
            evidenceRef: qualEvidence || null,
          }),
        },
      );
      applyMember(res.member);
      setQualEvidence("");
      setQualValidUntil("");
      toast.success(t("staffQualAdded"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffQualFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeQualification(qualificationId: string) {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/external-inspectors/${encodeURIComponent(membershipId)}/qualifications/${qualificationId}`,
        { method: "DELETE" },
      );
      applyMember(res.member);
      toast.success(t("staffQualRemoved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffQualFailed"));
    } finally {
      setBusy(false);
    }
  }

  return {
    member,
    refs,
    error,
    loading,
    busy,
    canManage,
    isInvited,
    readOnly,
    employerSelectOptions,
    name,
    setName,
    employerOrganisationId,
    setEmployerOrganisationId,
    commissionedFrom,
    setCommissionedFrom,
    commissionedTo,
    setCommissionedTo,
    liabilityUntil,
    setLiabilityUntil,
    liabilitySumEur,
    setLiabilitySumEur,
    originPostalCode,
    setOriginPostalCode,
    originCity,
    setOriginCity,
    radiusKm,
    setRadiusKm,
    skillCode,
    setSkillCode,
    levelCode,
    setLevelCode,
    skillValidUntil,
    setSkillValidUntil,
    skillEvidence,
    setSkillEvidence,
    qualCode,
    setQualCode,
    qualValidUntil,
    setQualValidUntil,
    qualEvidence,
    setQualEvidence,
    refresh,
    saveProfile,
    addSkill,
    removeSkill,
    addQualification,
    removeQualification,
  };
}
