"use client";

import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type {
  DerivedDuty,
  PrerequisiteItem,
  ProductKindDTO,
  ReclassifyContextDTO,
  RegistrationCharacteristics,
  RegistrationIdentityForm,
  RegistrationRefBundle,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
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
import { computeReleaseLevel } from "@/services/registration/deriveDuties";
import { openMandatoryPrerequisites } from "@/services/registration/prerequisites";
import type { RegistrationWizardApi } from "./useRegistrationWizard";

type PendingEvidence = {
  prerequisiteCode: string;
  evidenceKind: "document" | "third_party";
  externalRecordRef?: string | null;
  dataUrl?: string | null;
};

function emptyIdentity(): RegistrationIdentityForm {
  return {
    tradeName: "",
    manufacturer: "",
    modelName: "",
    serialNumber: "",
    udiDi: "",
    inventoryNumber: "",
    purchaseYear: "",
    responsiblePerson: "",
    responsibleUserId: "",
    siteId: "",
    areaId: "",
    room: "",
  };
}

/**
 * Model-wide reclassification wizard — reuses Characteristics/Duties/Prerequisites steps.
 * Starts at step 2; leaving step 2 without a kind returns to the catalog model.
 */
export function useReclassifyWizard(modelId: string) {
  const router = useRouter();
  const actorName = useSessionStore((s) => s.user?.name?.trim() || "Operator");
  const [step, setStepState] = useState(2);
  const [context, setContext] = useState<ReclassifyContextDTO | null>(null);
  const [kinds, setKinds] = useState<ProductKindDTO[]>([]);
  const [refData, setRefData] = useState<RegistrationRefBundle | null>(null);
  const [merkmale, setMerkmale] = useState<RegistrationCharacteristics>(emptyCharacteristics);
  const [duties, setDuties] = useState<DerivedDuty[]>([]);
  const [decisionProtocol, setDecisionProtocol] = useState<DecisionProtocolEntry[]>([]);
  const [prerequisites, setPrerequisites] = useState<PrerequisiteItem[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [pendingEvidence, setPendingEvidence] = useState<PendingEvidence[]>([]);
  const [acknowledgeImpact, setAcknowledgeImpact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kindQ, setKindQ] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedKind = useMemo(
    () => kinds.find((k) => k.code === merkmale.produktart) ?? null,
    [kinds, merkmale.produktart],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [k, r, ctx] = await Promise.all([
          api<{ kinds: ProductKindDTO[] }>("/api/registration/product-kinds"),
          api<RegistrationRefBundle>("/api/registration/ref"),
          api<{ context: ReclassifyContextDTO }>(`/api/registration/reclassify/${modelId}`),
        ]);
        setKinds(k.kinds);
        setRefData(r);
        setContext(ctx.context);
        const chars = ctx.context.characteristics?.produktart
          ? hydrateAnswerMeta(ctx.context.characteristics)
          : emptyCharacteristics();
        setMerkmale(chars);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load reclassify context");
      } finally {
        setLoading(false);
      }
    })();
  }, [modelId]);

  const setStep = useCallback(
    (n: SetStateAction<number>) => {
      setStepState((prev) => {
        const next = typeof n === "function" ? n(prev) : n;
        if (next < 2) {
          queueMicrotask(() => router.push(`/catalog/${modelId}`));
          return prev;
        }
        return next;
      });
    },
    [modelId, router],
  );

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
        answerAnlage2Choice(
          m,
          choice === ANLAGE2_NONE ? ANLAGE2_NONE : choice,
          itemNo,
          actorName,
          requiresVerfahren,
        ),
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

  const acknowledgeRule = useCallback(
    (hit: CheckRuleHit) => {
      setMerkmale((m) => acknowledgeCheckRule(m, hit, actorName));
    },
    [actorName],
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
    // Reclassify has no identity form year; year-based hints stay inactive.
    const openRules = openCheckRules(merkmale, { purchaseYear: null });
    if (openRules.length) {
      setError(openRules.map((r) => r.message).join(" · "));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const preview = await api<{ duties: DerivedDuty[]; prerequisites: PrerequisiteItem[] }>(
        `/api/registration/reclassify/${modelId}/derive`,
        {
          method: "POST",
          body: JSON.stringify({ characteristics: merkmale }),
        },
      );
      setDuties(preview.duties);
      setDecisionProtocol(buildDecisionProtocol(merkmale));
      setPrerequisites(preview.prerequisites);
      setPendingEvidence([]);
      const nextChecks: Record<string, boolean> = {};
      for (const p of preview.prerequisites) {
        if (p.erfuellt) nextChecks[p.k] = true;
      }
      setChecks(nextChecks);
      setStepState(3);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Duty derivation failed");
    } finally {
      setBusy(false);
    }
  }, [modelId, merkmale, selectedKind]);

  const checkHits = useMemo(
    () => evaluateCheckRules(merkmale, { purchaseYear: null }),
    [merkmale],
  );

  const openChecks = useMemo(
    () => openCheckRules(merkmale, { purchaseYear: null }),
    [merkmale],
  );

  const markEvidenceSatisfied = useCallback((code: string) => {
    setPrerequisites((prev) =>
      prev.map((p) =>
        p.k === code ? { ...p, evidenceId: p.evidenceId ?? "pending", erfuellt: true } : p,
      ),
    );
  }, []);

  const uploadEvidence = useCallback(
    async (code: string, file: File) => {
      setBusy(true);
      setError(null);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Read failed"));
          reader.readAsDataURL(file);
        });
        setPendingEvidence((prev) => {
          const rest = prev.filter((e) => e.prerequisiteCode !== code);
          return [
            ...rest,
            { prerequisiteCode: code, evidenceKind: "document", dataUrl },
          ];
        });
        markEvidenceSatisfied(code);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Evidence upload failed");
      } finally {
        setBusy(false);
      }
    },
    [markEvidenceSatisfied],
  );

  const setExternalEvidence = useCallback(
    async (code: string, ref: string) => {
      const trimmed = ref.trim();
      if (!trimmed) return;
      setError(null);
      setPendingEvidence((prev) => {
        const rest = prev.filter((e) => e.prerequisiteCode !== code);
        return [
          ...rest,
          {
            prerequisiteCode: code,
            evidenceKind: "third_party",
            externalRecordRef: trimmed,
          },
        ];
      });
      markEvidenceSatisfied(code);
    },
    [markEvidenceSatisfied],
  );

  const release = useCallback(async () => {
    setError(null);
    if (!acknowledgeImpact) {
      setError("Confirm that this change applies to all copies of the model.");
      return;
    }
    setBusy(true);
    try {
      const protocol = buildDecisionProtocol(merkmale);
      await api(`/api/registration/reclassify/${modelId}`, {
        method: "POST",
        body: JSON.stringify({
          characteristics: { ...merkmale, decisionProtocol: protocol },
          checks,
          acknowledgeImpact: true,
          evidence: pendingEvidence,
        }),
      });
      router.push(`/catalog/${modelId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reclassification failed");
    } finally {
      setBusy(false);
    }
  }, [acknowledgeImpact, checks, merkmale, modelId, pendingEvidence, router]);

  const selectedAnnex2 = useMemo(
    () => refData?.annex2.find((a) => a.id === merkmale.anlage2ItemId) ?? null,
    [refData, merkmale.anlage2ItemId],
  );

  const annex2Leaves = useMemo(() => (refData?.annex2 ?? []).filter((a) => !a.isGroup), [refData]);

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

  const openMandatory = useMemo(() => {
    const releaseLevel = computeReleaseLevel(merkmale);
    return openMandatoryPrerequisites(prerequisites, checks, {
      releaseLevel,
      requireEvidence: releaseLevel >= 2,
    });
  }, [prerequisites, checks, merkmale]);

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

  const form = emptyIdentity();

  const wizard: RegistrationWizardApi = {
    step,
    setStep,
    draftId: modelId,
    sites: [],
    areas: [],
    kinds,
    kindQ,
    setKindQ,
    kindGroups,
    refData,
    form,
    patchForm: () => undefined,
    fieldErrors: {},
    merkmale,
    patchMerkmale,
    answer,
    confirmField,
    confirmAllPending,
    deferAndSave: async () => undefined,
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
    uploadEvidence,
    setExternalEvidence,
    error,
    busy,
    selectedAnnex2,
    annex2Leaves,
    selectedReproc,
    selectedEquipment,
    selectedRadiation,
    openMandatory,
    saveIdentity: async () => undefined,
    saveCharacteristicsAndDerive,
    continueToPrerequisites: async () => undefined,
    continueFromDuties: async () => undefined,
    release,
    catalogLinkMode: false,
    maxStep: 4,
    unlockAndGo: (n) => setStep(n),
    identityPhase: "inventory",
    linkedModelId: modelId,
    hasClassificationPrefill: false,
    characteristicsSkipped: false,
    gtinInput: "",
    setGtinInput: () => undefined,
    resolveGtin: async () => undefined,
    selectCatalogModel: async () => undefined,
    startManualRegistration: () => undefined,
    clearLinkedModel: () => undefined,
    notInCatalogOpen: false,
    notInCatalogGtin: "",
    dismissNotInCatalog: () => undefined,
  };

  return {
    ...wizard,
    loading,
    context,
    acknowledgeImpact,
    setAcknowledgeImpact,
  };
}

export type ReclassifyWizardApi = ReturnType<typeof useReclassifyWizard>;
