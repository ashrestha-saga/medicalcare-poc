"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CatalogModelDetailDTO,
  DerivedDuty,
  DeviceInstanceDTO,
  PrerequisiteItem,
  ProductKindDTO,
  RegistrationCharacteristics,
  RegistrationDraftDTO,
  RegistrationIdentityForm,
  RegistrationRefBundle,
  ResolveResponse,
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
  deferField,
  emptyCharacteristics,
  formatUnansweredMessage,
  hydrateAnswerMeta,
  suggestFieldValue,
  unansweredVisibleFields,
  type DecisionProtocolEntry,
} from "@/services/registration/answerMeta";
import { mergeModelPrefill } from "@/services/registration/modelCharacteristics";
import { openMandatoryPrerequisites } from "@/services/registration/prerequisites";
import { computeReleaseLevel } from "@/services/registration/deriveDuties";
import {
  acknowledgeCheckRule,
  evaluateCheckRules,
  openCheckRules,
  type CheckRuleHit,
} from "@/services/registration/checkRules";
import { kindMatchesQuery } from "@/components/features/registration/kindDisplay";

export type RegistrationIdentityPhase = "lookup" | "inventory";

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

async function fetchModelDetail(modelId: string): Promise<CatalogModelDetailDTO> {
  const res = await api<{ model: CatalogModelDetailDTO }>(`/api/catalog/models/${modelId}`);
  return res.model;
}

async function derivePreview(
  merkmale: RegistrationCharacteristics,
  areaId: string,
  purchaseYear: string,
  trustCatalogModel = false,
): Promise<{ duties: DerivedDuty[]; prerequisites: PrerequisiteItem[] }> {
  const year = Number(purchaseYear);
  return api<{ duties: DerivedDuty[]; prerequisites: PrerequisiteItem[] }>(
    "/api/registration/preview",
    {
      method: "POST",
      body: JSON.stringify({
        characteristics: merkmale,
        areaId: areaId || null,
        purchaseYear: Number.isFinite(year) ? year : null,
        trustCatalogModel: trustCatalogModel || undefined,
      }),
    },
  );
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
  const [identityPhase, setIdentityPhase] = useState<RegistrationIdentityPhase>(
    initialDraftId ? "inventory" : "lookup",
  );
  const [linkedModelId, setLinkedModelId] = useState<string | null>(null);
  const [modelClassificationPrefill, setModelClassificationPrefill] =
    useState<RegistrationCharacteristics | null>(null);
  const [characteristicsSkipped, setCharacteristicsSkipped] = useState(false);
  /** Linked to catalog model with open classification — skip Merkmale + prerequisites. */
  const [catalogLinkMode, setCatalogLinkMode] = useState(false);
  const [gtinInput, setGtinInput] = useState("");
  const [notInCatalogOpen, setNotInCatalogOpen] = useState(false);
  const [notInCatalogGtin, setNotInCatalogGtin] = useState("");

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

  const applyPreviewResult = useCallback(
    (preview: { duties: DerivedDuty[]; prerequisites: PrerequisiteItem[] }, nextMerkmale: RegistrationCharacteristics) => {
      setDuties(preview.duties);
      setDecisionProtocol(buildDecisionProtocol(nextMerkmale));
      setPrerequisites(preview.prerequisites);
      const nextChecks: Record<string, boolean> = {};
      for (const p of preview.prerequisites) {
        if (p.erfuellt) nextChecks[p.k] = true;
      }
      setChecks(nextChecks);
    },
    [],
  );

  const applyLinkedModelDetail = useCallback((model: CatalogModelDetailDTO, serialHint?: string) => {
    setLinkedModelId(model.id);
    setModelClassificationPrefill(model.characteristicsPrefill);
    setCharacteristicsSkipped(false);
    setCatalogLinkMode(false);
    setForm((f) => ({
      ...f,
      tradeName: model.tradeName?.trim() || model.displayName || "",
      manufacturer: model.manufacturer?.trim() || "",
      modelName: model.modelName?.trim() || model.tradeName?.trim() || model.displayName || "",
      udiDi: model.udiDi?.trim() || model.basicUdiDi?.trim() || "",
      serialNumber: serialHint?.trim() || f.serialNumber,
    }));
    setIdentityPhase("inventory");
    setError(null);
    setFieldErrors({});
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
      setIdentityPhase("inventory");
      if (draft.model?.id) {
        setLinkedModelId(draft.model.id);
        setModelClassificationPrefill(draft.modelClassificationPrefill ?? null);
      }
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

      const hasInstanceChars = Boolean(draft.characteristics?.produktart);
      const hasModelPrefill = Boolean(draft.modelClassificationPrefill?.produktart);

      if (!hasInstanceChars && hasModelPrefill && draft.modelClassificationPrefill) {
        const year = draft.purchaseYear ? String(draft.purchaseYear) : "";
        const characteristics = hydrateAnswerMeta(
          mergeModelPrefill(emptyCharacteristics(), draft.modelClassificationPrefill),
        );
        setMerkmale(characteristics);
        try {
          const preview = await derivePreview(characteristics, draft.areaId ?? "", year, true);
          applyPreviewResult(preview, characteristics);
          setCharacteristicsSkipped(true);
          setCatalogLinkMode(true);
          setMaxStep(3);
          setStep(3);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not derive duties from catalog model");
          setMaxStep(1);
          setStep(1);
        }
        return;
      }

      setMerkmale(() => {
        const base = hasInstanceChars
          ? hydrateAnswerMeta(draft.characteristics)
          : emptyCharacteristics();
        if (
          hasInstanceChars &&
          draft.modelClassificationPrefill &&
          draft.modelClassificationFieldStates
        ) {
          return base;
        }
        return base;
      });
      if (hasInstanceChars || hasModelPrefill) {
        setMaxStep(2);
        setStep(2);
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load draft"));
  }, [initialDraftId, applyPreviewResult, actorName]);

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

  const resolveGtin = useCallback(
    async (rawOverride?: string) => {
      const raw = (rawOverride ?? gtinInput).trim();
      if (!raw) return;
      setGtinInput(raw);
      setError(null);
      setNotInCatalogOpen(false);
      setBusy(true);
      try {
        const res = await api<ResolveResponse>("/api/resolve", {
          method: "POST",
          body: JSON.stringify({ raw, context: "service" }),
        });
        if (res.stage === "capture" || !res.model?.id) {
          setNotInCatalogGtin(raw);
          setNotInCatalogOpen(true);
          return;
        }
        const detail = await fetchModelDetail(res.model.id);
        applyLinkedModelDetail(detail, res.identifier.serial);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "GTIN lookup failed");
      } finally {
        setBusy(false);
      }
    },
    [gtinInput, applyLinkedModelDetail],
  );

  const selectCatalogModel = useCallback(
    async (modelId: string) => {
      setError(null);
      setBusy(true);
      try {
        const detail = await fetchModelDetail(modelId);
        applyLinkedModelDetail(detail);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load catalog model");
      } finally {
        setBusy(false);
      }
    },
    [applyLinkedModelDetail],
  );

  const startManualRegistration = useCallback((udiHint?: string) => {
    setLinkedModelId(null);
    setModelClassificationPrefill(null);
    setCharacteristicsSkipped(false);
    setCatalogLinkMode(false);
    setMerkmale(emptyCharacteristics());
    setNotInCatalogOpen(false);
    setForm((f) => ({
      ...emptyIdentity(),
      siteId: f.siteId,
      areaId: f.areaId,
      room: f.room,
      responsibleUserId: f.responsibleUserId,
      responsiblePerson: f.responsiblePerson,
      purchaseYear: f.purchaseYear,
      udiDi: (udiHint ?? (notInCatalogGtin || gtinInput)).trim(),
    }));
    setIdentityPhase("inventory");
    setError(null);
    setFieldErrors({});
  }, [gtinInput, notInCatalogGtin]);

  const dismissNotInCatalog = useCallback(() => {
    setNotInCatalogOpen(false);
  }, []);

  const clearLinkedModel = useCallback(() => {
    setLinkedModelId(null);
    setModelClassificationPrefill(null);
    setCharacteristicsSkipped(false);
    setCatalogLinkMode(false);
    setMerkmale(emptyCharacteristics());
    setForm(emptyIdentity());
    setGtinInput("");
    setIdentityPhase("lookup");
    setDuties([]);
    setPrerequisites([]);
    setDecisionProtocol([]);
    setChecks({});
    setMaxStep(1);
    setStep(1);
    setError(null);
    setFieldErrors({});
  }, []);

  const saveIdentity = useCallback(async () => {
    setError(null);
    if (linkedModelId && !form.serialNumber.trim()) {
      setFieldErrors({ serialNumber: "Serial number is required when linking a catalog model." });
      return;
    }
    const parsed = registrationIdentityFormSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    if (linkedModelId) {
      setBusy(true);
      try {
        const dup = await api<{ device: DeviceInstanceDTO | null }>(
          `/api/devices?serial=${encodeURIComponent(parsed.data.serialNumber!.trim())}&modelId=${encodeURIComponent(linkedModelId)}`,
        );
        if (dup.device) {
          setError(
            `Serial already in inventory${dup.device.inventoryNumber ? ` · ${dup.device.inventoryNumber}` : ""}.`,
          );
          setBusy(false);
          return;
        }

        if (modelClassificationPrefill?.produktart) {
          const characteristics = hydrateAnswerMeta(
            mergeModelPrefill(emptyCharacteristics(), modelClassificationPrefill),
          );
          setMerkmale(characteristics);
          const preview = await derivePreview(
            characteristics,
            parsed.data.areaId,
            parsed.data.purchaseYear,
            true,
          );
          applyPreviewResult(preview, characteristics);
          setCharacteristicsSkipped(true);
          setCatalogLinkMode(true);
          unlockAndGo(3);
          return;
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not continue with linked model");
        return;
      } finally {
        setBusy(false);
      }
    }

    setCharacteristicsSkipped(false);
    setCatalogLinkMode(false);
    unlockAndGo(2);
  }, [form, linkedModelId, modelClassificationPrefill, unlockAndGo, applyPreviewResult]);

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
      const preview = await derivePreview(merkmale, form.areaId, form.purchaseYear);
      applyPreviewResult(preview, merkmale);
      setCharacteristicsSkipped(false);
      unlockAndGo(3);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Duty derivation failed");
    } finally {
      setBusy(false);
    }
  }, [merkmale, form.areaId, form.purchaseYear, selectedKind, unlockAndGo, applyPreviewResult]);

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

  /** Persist identity + characteristics so evidence / catalog-link release can attach. */
  const ensureDraft = useCallback(
    async (characteristics: RegistrationCharacteristics = merkmale): Promise<string> => {
      const year = Number(form.purchaseYear);
      const payload = {
        modelId: linkedModelId || undefined,
        tradeName: form.tradeName,
        manufacturer: form.manufacturer,
        modelName: form.modelName || form.tradeName,
        serialNumber: form.serialNumber || null,
        udiDi: form.udiDi || null,
        inventoryNumber: form.inventoryNumber || null,
        purchaseYear: Number.isFinite(year) ? year : null,
        responsiblePerson: form.responsiblePerson || null,
        responsibleUserId: form.responsibleUserId || null,
        areaId: form.areaId || null,
        room: form.room || null,
        productKindCode: characteristics.produktart,
        characteristics,
        keepDraft: true,
        catalogLink: catalogLinkMode || undefined,
      };
      if (draftId) {
        await api(`/api/registration/drafts/${draftId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        return draftId;
      }
      const res = await api<{ draft: { id: string } }>("/api/registration/drafts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDraftId(res.draft.id);
      return res.draft.id;
    },
    [form, linkedModelId, draftId, merkmale, catalogLinkMode],
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
      setStep(catalogLinkMode || characteristicsSkipped ? 1 : 2);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const id = catalogLinkMode ? await ensureDraft() : draftId;
      const year = Number(parsed.data.purchaseYear);
      const protocol = buildDecisionProtocol(merkmale);
      const { result } = await api<{ result: { id: string } }>("/api/registration/release", {
        method: "POST",
        body: JSON.stringify({
          draftId: id || undefined,
          modelId: linkedModelId || undefined,
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
          checks: catalogLinkMode ? {} : checks,
          catalogLink: catalogLinkMode || undefined,
        }),
      });
      router.push(`/devices?highlight=${result.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Release failed");
    } finally {
      setBusy(false);
    }
  }, [
    form,
    merkmale,
    draftId,
    checks,
    router,
    linkedModelId,
    characteristicsSkipped,
    catalogLinkMode,
    ensureDraft,
  ]);

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
    () =>
      openMandatoryPrerequisites(prerequisites, checks, {
        releaseLevel: computeReleaseLevel(merkmale),
        requireEvidence: computeReleaseLevel(merkmale) >= 2,
      }),
    [prerequisites, checks, merkmale],
  );

  const deferAndSave = useCallback(
    async (field: string, label: string) => {
      setError(null);
      setBusy(true);
      try {
        const next = deferField(merkmale, field, actorName);
        setMerkmale(next);
        const year = Number(form.purchaseYear);
        const payload = {
          modelId: linkedModelId || undefined,
          tradeName: form.tradeName,
          manufacturer: form.manufacturer,
          modelName: form.modelName || form.tradeName,
          serialNumber: form.serialNumber || null,
          udiDi: form.udiDi || null,
          inventoryNumber: form.inventoryNumber || null,
          purchaseYear: Number.isFinite(year) ? year : null,
          responsiblePerson: form.responsiblePerson || null,
          responsibleUserId: form.responsibleUserId || null,
          areaId: form.areaId || null,
          room: form.room || null,
          productKindCode: next.produktart,
          characteristics: next,
          keepDraft: true,
          clarifications: [
            { kind: "classification", field, label: label || `Deferred: ${field}` },
          ],
        };
        if (draftId) {
          await api(`/api/registration/drafts/${draftId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        } else {
          const res = await api<{ draft: { id: string } }>("/api/registration/drafts", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setDraftId(res.draft.id);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not save deferred draft");
      } finally {
        setBusy(false);
      }
    },
    [merkmale, actorName, form, draftId, linkedModelId],
  );

  const continueToPrerequisites = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await ensureDraft();
      unlockAndGo(4);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save draft for prerequisites");
    } finally {
      setBusy(false);
    }
  }, [ensureDraft, unlockAndGo]);

  /** After duties: catalog link releases immediately; greenfield continues to prerequisites. */
  const continueFromDuties = useCallback(async () => {
    if (catalogLinkMode) {
      await release();
      return;
    }
    await continueToPrerequisites();
  }, [catalogLinkMode, release, continueToPrerequisites]);

  const uploadEvidence = useCallback(
    async (code: string, file: File) => {
      setBusy(true);
      setError(null);
      try {
        const id = await ensureDraft();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Read failed"));
          reader.readAsDataURL(file);
        });
        await api(`/api/registration/drafts/${id}/evidence`, {
          method: "POST",
          body: JSON.stringify({
            prerequisiteCode: code,
            evidenceKind: "document",
            dataUrl,
          }),
        });
        setPrerequisites((prev) =>
          prev.map((p) =>
            p.k === code ? { ...p, evidenceId: "uploaded", erfuellt: true } : p,
          ),
        );
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Evidence upload failed");
      } finally {
        setBusy(false);
      }
    },
    [ensureDraft],
  );

  const setExternalEvidence = useCallback(
    async (code: string, ref: string) => {
      setBusy(true);
      setError(null);
      try {
        const id = await ensureDraft();
        await api(`/api/registration/drafts/${id}/evidence`, {
          method: "POST",
          body: JSON.stringify({
            prerequisiteCode: code,
            evidenceKind: "third_party",
            externalRecordRef: ref,
          }),
        });
        setPrerequisites((prev) =>
          prev.map((p) =>
            p.k === code ? { ...p, evidenceId: "external", erfuellt: true } : p,
          ),
        );
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not record external evidence");
      } finally {
        setBusy(false);
      }
    },
    [ensureDraft],
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
    deferAndSave,
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
    saveIdentity,
    saveCharacteristicsAndDerive,
    continueToPrerequisites,
    continueFromDuties,
    release,
    catalogLinkMode,
    identityPhase,
    linkedModelId,
    hasClassificationPrefill: Boolean(modelClassificationPrefill?.produktart),
    characteristicsSkipped,
    gtinInput,
    setGtinInput,
    resolveGtin,
    selectCatalogModel,
    startManualRegistration,
    clearLinkedModel,
    notInCatalogOpen,
    notInCatalogGtin,
    dismissNotInCatalog,
  };
}

export type RegistrationWizardApi = ReturnType<typeof useRegistrationWizard>;
