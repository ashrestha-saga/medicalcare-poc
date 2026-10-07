"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CreateTrainingEventResultDTO,
  TrainingFormOptionsDTO,
  TrainingTypeOptionDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";

type Mode = "individual" | "group";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function typeByCode(
  types: TrainingTypeOptionDTO[],
  code: string,
): TrainingTypeOptionDTO | undefined {
  return types.find((t) => t.code === code);
}

export function useRecordTrainingForm({
  form,
  onCreated,
}: {
  form: TrainingFormOptionsDTO;
  onCreated: (eventId: string) => void;
}) {
  const t = useTranslations("trainingDetail");
  const defaultType = form.types[0]?.code ?? "";
  const [trainingTypeCode, setTrainingTypeCode] = useState(defaultType);
  const selectedType = useMemo(
    () => typeByCode(form.types, trainingTypeCode),
    [form.types, trainingTypeCode],
  );
  const subjectKind = selectedType?.subjectKind ?? "model";

  const [subjectModelId, setSubjectModelId] = useState("");
  const [subjectActivity, setSubjectActivity] = useState(form.activities[0] ?? "");
  const [heldOn, setHeldOn] = useState(todayIso());
  const [location, setLocation] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [instructorQualification, setInstructorQualification] = useState("");
  const [instructorExternal, setInstructorExternal] = useState(false);
  const [basisDocument, setBasisDocument] = useState("");
  const [mode, setMode] = useState<Mode>("group");
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTypeChange = useCallback(
    (code: string) => {
      setTrainingTypeCode(code);
      const next = typeByCode(form.types, code);
      if (next?.subjectKind === "activity" && !subjectActivity && form.activities[0]) {
        setSubjectActivity(form.activities[0]);
      }
    },
    [form.activities, form.types, subjectActivity],
  );

  const setModeSafe = useCallback(
    (next: Mode) => {
      setMode(next);
      if (next === "individual" && personIds.length > 1) {
        setPersonIds(personIds.slice(0, 1));
      }
    },
    [personIds],
  );

  const togglePerson = useCallback(
    (id: string) => {
      if (mode === "individual") {
        setPersonIds([id]);
        return;
      }
      setPersonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [mode],
  );

  const submit = useCallback(async () => {
    setError(null);
    const missing: string[] = [];
    if (subjectKind === "model" && !subjectModelId) missing.push("device model");
    if (subjectKind === "activity" && !subjectActivity) missing.push("activity");
    if (!heldOn.trim()) missing.push("date");
    if (!instructorName.trim()) missing.push("instructor");
    if (!instructorQualification.trim()) missing.push("instructor qualification");
    if (!basisDocument.trim()) missing.push("basis document");
    if (personIds.length === 0) missing.push("at least one participant");
    if (missing.length) {
      setError(`Missing: ${missing.join(", ")}.`);
      return;
    }

    setSaving(true);
    try {
      const result = await api<CreateTrainingEventResultDTO>("/api/training", {
        method: "POST",
        body: JSON.stringify({
          trainingTypeCode,
          subjectModelId: subjectKind === "model" ? subjectModelId : null,
          subjectActivity: subjectKind === "activity" ? subjectActivity : null,
          heldOn,
          location: location.trim() || null,
          instructorName: instructorName.trim(),
          instructorQualification: instructorQualification.trim(),
          instructorExternal,
          basisDocument: basisDocument.trim(),
          mode,
          personIds,
        }),
      });
      onCreated(result.event.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create training records");
    } finally {
      setSaving(false);
    }
  }, [
    basisDocument,
    heldOn,
    instructorExternal,
    instructorName,
    instructorQualification,
    location,
    mode,
    onCreated,
    personIds,
    subjectActivity,
    subjectKind,
    subjectModelId,
    trainingTypeCode,
  ]);

  const recordHint =
    personIds.length === 1
      ? t("recordHintOne")
      : t("recordHintMany", { count: personIds.length });

  return {
    form,
    selectedType,
    subjectKind,
    trainingTypeCode,
    onTypeChange,
    subjectModelId,
    setSubjectModelId,
    subjectActivity,
    setSubjectActivity,
    heldOn,
    setHeldOn,
    location,
    setLocation,
    instructorName,
    setInstructorName,
    instructorQualification,
    setInstructorQualification,
    instructorExternal,
    setInstructorExternal,
    basisDocument,
    setBasisDocument,
    mode,
    setModeSafe,
    personIds,
    togglePerson,
    saving,
    error,
    submit,
    recordHint,
  };
}

export type RecordTrainingFormApi = ReturnType<typeof useRecordTrainingForm>;
