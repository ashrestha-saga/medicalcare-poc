"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ConsoleStaffListDTO,
  ConsoleStaffMemberDTO,
  ConsoleStaffRefsDTO,
} from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

/** Partner console — staff member detail, profile, skills, quals, assignments. */
export function useStaffDetail(membershipId: string) {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canEdit = checkPermission("console:staff:invite");
  const canAssign = checkPermission("console:staff:assign");

  const [member, setMember] = useState<ConsoleStaffMemberDTO | null>(null);
  const [clinics, setClinics] = useState<ConsoleStaffListDTO["clinics"]>([]);
  const [refs, setRefs] = useState<ConsoleStaffRefsDTO | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [appRole, setAppRole] = useState<"admin" | "inspector" | "order">("inspector");
  const [validFrom, setValidFrom] = useState("");
  const [dispatchOrigin, setDispatchOrigin] = useState<
    "home" | "partner_site" | "organisation"
  >("organisation");
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
    setJobTitle(m.jobTitle ?? "");
    setAppRole((m.appRole as "admin" | "inspector" | "order") || "inspector");
    setValidFrom(m.validFrom ?? "");
    setDispatchOrigin(m.dispatchOrigin ?? "organisation");
    setOriginPostalCode(m.originPostalCode ?? "");
    setOriginCity(m.originCity ?? "");
    setRadiusKm(m.radiusKm != null ? String(m.radiusKm) : "");
    setSelected(m.assignedTenantIds);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, staff] = await Promise.all([
        api<{ member: ConsoleStaffMemberDTO }>(
          `/api/partner/staff/${encodeURIComponent(membershipId)}`,
        ),
        api<ConsoleStaffListDTO>("/api/partner/staff"),
      ]);
      applyMember(detail.member);
      setClinics(staff.clinics);
      setRefs(staff.refs);
      setSkillCode((prev) => prev || staff.refs.skills[0]?.code || "");
      setLevelCode((prev) => prev || staff.refs.skillLevels[0]?.code || "");
      setQualCode((prev) => prev || staff.refs.qualifications[0]?.code || "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("staffLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [membershipId, t, applyMember]);

  useEffect(() => {
    // Initial fetch — setState inside async refresh is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load detail on mount
    void refresh();
  }, [refresh]);

  const isInvited = member?.status === "invited";
  const isAdmin = member?.appRole === "admin" && !member.isExternal;

  async function saveProfile() {
    setBusy(true);
    try {
      const radius = radiusKm.trim() === "" ? null : Number.parseInt(radiusKm.trim(), 10);
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/staff/${encodeURIComponent(membershipId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            jobTitle: jobTitle || null,
            appRole,
            validFrom: validFrom || undefined,
            dispatchOrigin,
            originPostalCode: originPostalCode || null,
            originCity: originCity || null,
            radiusKm: Number.isFinite(radius as number) ? radius : null,
          }),
        },
      );
      applyMember(res.member);
      toast.success(t("staffProfileSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffProfileFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignments() {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/staff/${encodeURIComponent(membershipId)}/assignments`,
        { method: "PUT", body: JSON.stringify({ tenantIds: selected }) },
      );
      applyMember(res.member);
      toast.success(t("staffAssignSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffAssignFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addSkill() {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/staff/${encodeURIComponent(membershipId)}/skills`,
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
        `/api/partner/staff/${encodeURIComponent(membershipId)}/skills/${skillId}`,
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
        `/api/partner/staff/${encodeURIComponent(membershipId)}/qualifications`,
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
        `/api/partner/staff/${encodeURIComponent(membershipId)}/qualifications/${qualificationId}`,
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

  function toggle(tenantId: string) {
    setSelected((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId],
    );
  }

  return {
    member,
    clinics,
    refs,
    selected,
    error,
    loading,
    busy,
    canEdit,
    canAssign,
    isInvited,
    isAdmin,
    name,
    setName,
    jobTitle,
    setJobTitle,
    appRole,
    setAppRole,
    validFrom,
    setValidFrom,
    dispatchOrigin,
    setDispatchOrigin,
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
    saveAssignments,
    addSkill,
    removeSkill,
    addQualification,
    removeQualification,
    toggle,
  };
}
