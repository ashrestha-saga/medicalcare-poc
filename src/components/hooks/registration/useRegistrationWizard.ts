"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DerivedDuty,
  PrerequisiteItem,
  ProductKindDTO,
  RegistrationCharacteristics,
  RegistrationDraftDTO,
  RegistrationIdentityForm,
  RegistrationRefBundle,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { registrationIdentityFormSchema } from "@/schemas/registration";
import { zodFieldErrors } from "@/schemas/formErrors";
import { useSites } from "@/components/hooks/location/useSites";
import { useSessionStore } from "@/store/sessionStore";
import { applyProductKindPresets, blockVisible } from "@/services/registration/productKindLogic";
import {
  ANLAGE2_NONE,
  answerAnlage2Choice,
  answerField,
  answerMessgroesse,
  answerMessvariante,
  buildDecisionProtocol,
  confirmAllSuggestions,
  confirmSuggestion,
  emptyCharacteristics,
  formatUnansweredMessage,
  hydrateAnswerMeta,
  suggestFieldValue,
  unansweredVisibleFields,
  type DecisionProtocolEntry,
} from "@/services/registration/answerMeta";
import {
  acknowledgeCheckRule,
  evaluateCheckRules,
  openCheckRules,
  type CheckRuleHit,
} from "@/services/registration/checkRules";
import { kindMatchesQuery } from "@/components/features/registration/kindDisplay";

function emptyIdentity(): RegistrationIdentityForm {
  return {
    tradeName: "",
    manufacturer: "",
    modelName: "",
    serialNumber: "",
    udiDi: "",
    inventoryNumber: "",
    purchaseYear: String(new Date().getFullYear()),
    responsiblePerson: "",
    responsibleUserId: "",
    siteId: "",
    areaId: "",
    room: "",
  };
}

/**
 * Erstanlage wizard state + API orchestration.
 * Identity and characteristics stay in memory until release (inventarize resume still hydrates an existing draft).
 */
export function useRegistrationWizard(initialDraftId?: string) {
  const router = useRouter();
  const sites = useSites();
  const actorName = useSessionStore((s) => s.user?.name?.trim() || "Operator");
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [kinds, setKinds] = useState<ProductKindDTO[]>([]);
  const [refData, setRefData] = useState<RegistrationRefBundle | null>(null);
  const [form, setForm] = useState<RegistrationIdentityForm>(emptyIdentity);
  const [merkmale, setMerkmale] = useState<RegistrationCharacteristics>(emptyCharacteristics);
  const [duties, setDuties] = useState<DerivedDuty[]>([]);
  const [decisionProtocol, setDecisionProtocol] = useState<DecisionProtocolEntry[]>([]);
  const [prerequisites, setPrerequisites] = useState<PrerequisiteItem[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [kindQ, setKindQ] = useState("");

  const selectedKind = useMemo(
    () => kinds.find((k) => k.code === merkmale.produktart) ?? null,
    [kinds, merkmale.produktart],
  );

  const areas = useMemo(() => {
    const site = sites.find((s) => s.id === form.siteId);
    return site?.areas ?? [];
  }, [sites, form.siteId]);

  const goToStep = useCallback(
    (n: number) => {
      if (n < 1 || n > maxStep) return;
      setStep(n);
    },
    [maxStep],
  );

  const unlockAndGo = useCallback((n: number) => {
    setMaxStep((m) => Math.max(m, n));
    setStep(n);
  }, []);

  useEffect(() => {
    void (async () => {
      const [k, r] = await Promise.all([
        api<{ kinds: ProductKindDTO[] }>("/api/registration/product-kinds"),
        api<RegistrationRefBundle>("/api/registration/ref"),
      ]);
      setKinds(k.kinds);
      setRefData(r);
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  useEffect(() => {
    if (!initialDraftId) return;
    void (async () => {
      const { draft } = await api<{ draft: RegistrationDraftDTO }>(
        `/api/registration/drafts/${initialDraftId}`,
      );
      setDraftId(draft.id);
      setForm({
        tradeName: draft.model?.tradeName ?? "",
        manufacturer: draft.model?.manufacturer ?? "",
        modelName: draft.model?.modelName ?? "",
        serialNumber: draft.serialNumber ?? "",
        udiDi: draft.udiDi ?? "",
        inventoryNumber: draft.inventoryNumber,
        purchaseYear: draft.purchaseYear ? String(draft.purchaseYear) : "",
        responsiblePerson: draft.responsiblePerson ?? "",
        responsibleUserId: draft.responsibleUserId ?? "",
        siteId: draft.siteId ?? "",
        areaId: draft.areaId ?? "",
        room: draft.room ?? "",
      });
      setMerkmale(
        draft.characteristics?.produktart
          ? hydrateAnswerMeta(draft.characteristics)
          : emptyCharacteristics(),
      );
      if (draft.characteristics?.produktart) {
        setMaxStep(2);
        setStep(2);
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load draft"));
  }, [initialDraftId]);

  const patchForm = useCallback((partial: Partial<RegistrationIdentityForm>) => {
    setForm((f) => ({ ...f, ...partial }));
  }, []);

  const patchMerkmale = useCallback((partial: Partial<RegistrationCharacteristics>) => {
    setMerkmale((m) => ({ ...m, ...partial }));
  }, []);

  const answer = useCallback(
    (field: string, value: unknown) => {
      setMerkmale((m) => answerField(m, field, value, actorName));
    },
    [actorName],
  );

  const confirmField = useCallback(
    (field: string) => {
      setMerkmale((m) => confirmSuggestion(m, field, actorName));
    },
    [actorName],
  );

  const confirmAllPending = useCallback(() => {
    setMerkmale((m) => confirmAllSuggestions(m, actorName));
  }, [actorName]);

  const answerAnlage2 = useCallback(
    (choice: string, itemNo: string | undefined, requiresVerfahren: boolean) => {
      setMerkmale((m) =>
        answerAnlage2Choice(m, choice === ANLAGE2_NONE ? ANLAGE2_NONE : choice, itemNo, actorName, requiresVerfahren),
      );
    },
    [actorName],
  );

  const answerMessung = useCallback(
    (key: string) => {
      setMerkmale((m) => {
        const leaves = (refData?.annex2 ?? []).filter((a) => !a.isGroup);
        return answerMessgroesse(m, key, actorName, leaves);
      });
    },
    [actorName, refData],
  );

  const answerMessungVariante = useCallback(
    (variante: string) => {
      setMerkmale((m) => {
        const leaves = (refData?.annex2 ?? []).filter((a) => !a.isGroup);
        return answerMessvariante(m, variante, actorName, leaves);
      });
    },
    [actorName, refData],
  );

  const suggestZulassung = useCallback((zul: string) => {
    setMerkmale((m) => suggestFieldValue(m, "zulassung", zul));
  }, []);

  const show = useCallback(
    (key: string) => blockVisible(selectedKind, key, Boolean(merkmale.weitere)),
    [selectedKind, merkmale.weitere],
  );

  const selectProductKind = useCallback((kind: ProductKindDTO) => {
    setMerkmale(applyProductKindPresets(kind));
  }, []);

  const resetCharacteristics = useCallback(() => {
    setMerkmale(emptyCharacteristics());
  }, []);

  const saveIdentity = useCallback(async () => {
    setError(null);
    const parsed = registrationIdentityFormSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    unlockAndGo(2);
  }, [form, unlockAndGo]);

  const saveCharacteristicsAndDerive = useCallback(async () => {
    if (!merkmale.produktart) {
      setError("Select a product kind.");
      return;
    }
    const missing = unansweredVisibleFields(merkmale, selectedKind);
    if (missing.length) {
      setError(formatUnansweredMessage(missing));
      return;
    }
    const openRules = openCheckRules(merkmale, { purchaseYear: form.purchaseYear });
    if (openRules.length) {
      setError(openRules.map((r) => r.message).join(" · "));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const year = Number(form.purchaseYear);
      const preview = await api<{ duties: DerivedDuty[]; prerequisites: PrerequisiteItem[] }>(
        "/api/registration/preview",
        {
          method: "POST",
          body: JSON.stringify({
            characteristics: merkmale,
            areaId: form.areaId || null,
            purchaseYear: Number.isFinite(year) ? year : null,
          }),
        },
      );
      setDuties(preview.duties);
      setDecisionProtocol(buildDecisionProtocol(merkmale));
      setPrerequisites(preview.prerequisites);
      const nextChecks: Record<string, boolean> = {};
      for (const p of preview.prerequisites) {
        if (p.erfuellt) nextChecks[p.k] = true;
      }
      setChecks(nextChecks);
      unlockAndGo(3);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Duty derivation failed");
    } finally {
      setBusy(false);
    }
  }, [merkmale, form.areaId, form.purchaseYear, selectedKind, unlockAndGo]);

  const acknowledgeRule = useCallback(
    (hit: CheckRuleHit) => {
      setMerkmale((m) => acknowledgeCheckRule(m, hit, actorName));
    },
    [actorName],
  );

  const checkHits = useMemo(
    () => evaluateCheckRules(merkmale, { purchaseYear: form.purchaseYear }),
    [merkmale, form.purchaseYear],
  );

  const openChecks = useMemo(
    () => openCheckRules(merkmale, { purchaseYear: form.purchaseYear }),
    [merkmale, form.purchaseYear],
  );

  const release = useCallback(async () => {
    setError(null);
    const parsed = registrationIdentityFormSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setStep(1);
      return;
    }
    if (!merkmale.produktart) {
      setError("Select a product kind.");
      setStep(2);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const year = Number(parsed.data.purchaseYear);
      const protocol = buildDecisionProtocol(merkmale);
      const { result } = await api<{ result: { id: string } }>("/api/registration/release", {
        method: "POST",
        body: JSON.stringify({
          draftId: draftId || undefined,
          tradeName: parsed.data.tradeName,
          manufacturer: parsed.data.manufacturer,
          modelName: parsed.data.modelName || parsed.data.tradeName,
          serialNumber: parsed.data.serialNumber || null,
          udiDi: parsed.data.udiDi || null,
          inventoryNumber: parsed.data.inventoryNumber || null,
          purchaseYear: year,
          responsiblePerson: parsed.data.responsiblePerson || null,
          responsibleUserId: parsed.data.responsibleUserId || null,
          areaId: parsed.data.areaId || null,
          room: parsed.data.room || null,
          productKindCode: merkmale.produktart,
          characteristics: {
            ...merkmale,
            decisionProtocol: protocol,
          },
          checks,
        }),
      });
      router.push(`/devices?highlight=${result.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Release failed");
    } finally {
      setBusy(false);
    }
  }, [form, merkmale, draftId, checks, router]);

  const selectedAnnex2 = useMemo(
    () => refData?.annex2.find((a) => a.id === merkmale.anlage2ItemId) ?? null,
    [refData, merkmale.anlage2ItemId],
  );

  const annex2Leaves = useMemo(
    () => (refData?.annex2 ?? []).filter((a) => !a.isGroup),
    [refData],
  );

  const selectedReproc = useMemo(
    () => refData?.reprocessing.find((r) => r.code === merkmale.aufbKlasse) ?? null,
    [refData, merkmale.aufbKlasse],
  );

  const selectedEquipment = useMemo(
    () => refData?.equipment.find((e) => e.code === merkmale.eigenTyp) ?? null,
    [refData, merkmale.eigenTyp],
  );

  const selectedRadiation = useMemo(
    () => refData?.radiation.find((r) => r.code === merkmale.strahlenArt) ?? null,
    [refData, merkmale.strahlenArt],
  );

  const openMandatory = useMemo(
    () => prerequisites.filter((p) => p.pflicht && !p.erfuellt && !checks[p.k]),
    [prerequisites, checks],
  );

  const kindGroups = useMemo(() => {
    const map = new Map<string, ProductKindDTO[]>();
    for (const k of kinds) {
      if (k.code === "sonstiges") continue;
      if (!kindMatchesQuery(k.code, k.label, k.hint, kindQ)) continue;
      const list = map.get(k.sortGroup) ?? [];
      list.push(k);
      map.set(k.sortGroup, list);
    }
    return map;
  }, [kinds, kindQ]);

  return {
    step,
    setStep: goToStep,
    maxStep,
    unlockAndGo,
    draftId,
    sites,
    areas,
    kinds,
    kindQ,
    setKindQ,
    kindGroups,
    refData,
    form,
    patchForm,
    fieldErrors,
    merkmale,
    patchMerkmale,
    answer,
    confirmField,
    confirmAllPending,
    answerAnlage2,
    answerMessung,
    answerMessungVariante,
    suggestZulassung,
    acknowledgeRule,
    checkHits,
    openChecks,
    actorName,
    selectProductKind,
    resetCharacteristics,
    selectedKind,
    show,
    duties,
    decisionProtocol,
    prerequisites,
    checks,
    setChecks,
    error,
    busy,
    selectedAnnex2,
    annex2Leaves,
    selectedReproc,
    selectedEquipment,
    selectedRadiation,
    openMandatory,
    saveIdentity,
    saveCharacteristicsAndDerive,
    release,
  };
}

export type RegistrationWizardApi = ReturnType<typeof useRegistrationWizard>;
