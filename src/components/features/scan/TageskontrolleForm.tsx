"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScanRoutineOpenDTO, ScanRoutineResultDTO, ScanRoutineStepDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type Answer = { passed: boolean | null; measuredValue: string };

export function TageskontrolleForm({
  deviceId,
  onCancel,
  onSaved,
}: {
  deviceId: string;
  onCancel: () => void;
  onSaved: (result: ScanRoutineResultDTO) => void;
}) {
  const t = useTranslations("scan.routine");
  const [open, setOpen] = useState<ScanRoutineOpenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ routine: ScanRoutineOpenDTO }>(`/api/scan/devices/${deviceId}/routine`)
      .then((res) => {
        if (!alive) return;
        setOpen(res.routine);
        const init: Record<string, Answer> = {};
        for (const s of res.routine.steps) {
          init[s.checkCode] = { passed: null, measuredValue: "" };
        }
        setAnswers(init);
      })
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : t("errLoad"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [deviceId, t]);

  const steps = open?.steps ?? [];
  const step: ScanRoutineStepDTO | undefined = steps[stepIndex];
  const answer = step ? answers[step.checkCode] : undefined;

  const hasMangel = useMemo(() => {
    if (!open) return false;
    return open.steps.some((s) => {
      const a = answers[s.checkCode];
      if (!a) return false;
      if (s.kind === "pass_fail") return a.passed === false;
      if (!a.measuredValue.trim() || !s.limitText) return false;
      const v = parseFloat(a.measuredValue.replace(",", "."));
      if (Number.isNaN(v)) return false;
      const le = s.limitText.match(/[≤<=]\s*([\d.,]+)/);
      if (le?.[1]) return v > parseFloat(le[1].replace(",", "."));
      const ge = s.limitText.match(/[≥>=]\s*([\d.,]+)/);
      if (ge?.[1]) return v < parseFloat(ge[1].replace(",", "."));
      return false;
    });
  }, [open, answers]);

  const stepDone = (s: ScanRoutineStepDTO, a: Answer | undefined): boolean => {
    if (!a) return false;
    if (s.kind === "pass_fail") return a.passed === true || a.passed === false;
    return a.measuredValue.trim().length > 0;
  };

  const answeredCount = steps.filter((s) => stepDone(s, answers[s.checkCode])).length;
  const onLast = stepIndex >= steps.length - 1;
  const showingNote = steps.length > 0 && onLast && stepDone(steps[stepIndex]!, answers[steps[stepIndex]!.checkCode]);

  const setPass = (passed: boolean) => {
    if (!step) return;
    setAnswers((prev) => ({
      ...prev,
      [step.checkCode]: { ...prev[step.checkCode]!, passed, measuredValue: "" },
    }));
    setError(null);
  };

  const setMeasure = (measuredValue: string) => {
    if (!step) return;
    setAnswers((prev) => ({
      ...prev,
      [step.checkCode]: { passed: null, measuredValue },
    }));
    setError(null);
  };

  const goNext = () => {
    if (!step || !answer) return;
    if (!stepDone(step, answer)) {
      setError(step.kind === "measure" ? t("errMeasure") : t("errPassFail"));
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      setError(null);
    }
  };

  const submit = async () => {
    if (!open) return;
    for (const s of open.steps) {
      if (!stepDone(s, answers[s.checkCode])) {
        setError(t("errIncomplete"));
        return;
      }
    }
    if (hasMangel && !note.trim()) {
      setError(t("errNote"));
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ result: ScanRoutineResultDTO }>(
        `/api/scan/devices/${deviceId}/routine`,
        {
          method: "POST",
          body: JSON.stringify({
            answers: open.steps.map((s) => ({
              checkCode: s.checkCode,
              passed: answers[s.checkCode]?.passed ?? null,
              measuredValue: answers[s.checkCode]?.measuredValue || null,
            })),
            note: note.trim() || null,
          }),
        },
      );
      onSaved(res.result);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("errSave"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="p-routine" data-testid="tageskontrolle-form">
        <p className="p-heute__empty">{t("loading")}</p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="p-routine" data-testid="tageskontrolle-form">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <p className="p-heute__empty">{t("errLoad")}</p>
      </section>
    );
  }

  if (steps.length === 0) {
    return (
      <section className="p-routine" data-testid="tageskontrolle-form">
        <header className="p-routine__head">
          <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
            ×
          </button>
          <h2>{t("title")}</h2>
          <p className="p-routine__sub">
            {open.label} · <span className="mono">{open.inventoryNumber}</span>
          </p>
        </header>
        <p className="p-heute__empty">{t("allDone")}</p>
        <footer className="p-routine__foot">
          <button type="button" className="p-routine__save" onClick={onCancel}>
            {t("back")}
          </button>
        </footer>
      </section>
    );
  }

  return (
    <section className="p-routine" data-testid="tageskontrolle-form">
      <header className="p-routine__head">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <h2>{t("title")}</h2>
        <p className="p-routine__sub">
          {open.label} · <span className="mono">{open.inventoryNumber}</span>
        </p>
        <p className="p-routine__progress">
          {t("progress", { current: Math.min(stepIndex + 1, steps.length), total: steps.length })}
        </p>
      </header>

      {step && !showingNote ? (
        <div className="p-routine__step" key={step.checkCode}>
          <p className="p-routine__question">{step.label}</p>
          {step.scope !== "equipment" ? (
            <p className="p-routine__scope">
              {t("siteScope", { site: open.siteName ?? "—" })}
            </p>
          ) : null}

          {step.kind === "pass_fail" ? (
            <div className="p-stoerung__drei">
              <button
                type="button"
                className={["p-stoerung__drei-b", answer?.passed === true ? "is-on" : ""].join(" ")}
                data-tone="ok"
                aria-pressed={answer?.passed === true}
                onClick={() => setPass(true)}
              >
                {t("ok")}
              </button>
              <button
                type="button"
                className={["p-stoerung__drei-b", answer?.passed === false ? "is-on" : ""].join(" ")}
                data-tone="stop"
                aria-pressed={answer?.passed === false}
                onClick={() => setPass(false)}
              >
                {t("defect")}
              </button>
            </div>
          ) : (
            <div className="p-routine__measure">
              <label htmlFor="rk-wert">
                {t("value")}
                {step.unit ? ` (${step.unit})` : ""}
                {step.limitText ? ` · ${step.limitText}` : ""}
              </label>
              <input
                id="rk-wert"
                inputMode="decimal"
                value={answer?.measuredValue ?? ""}
                onChange={(e) => setMeasure(e.target.value)}
                placeholder={t("valuePlaceholder")}
              />
            </div>
          )}
        </div>
      ) : null}

      {showingNote ? (
        <div className="p-routine__step">
          <p className="p-routine__question">
            {hasMangel ? t("noteRequired") : t("noteOptional")}
          </p>
          {hasMangel ? (
            <p className="p-routine__warn">{t("mangelWarn")}</p>
          ) : (
            <p className="p-heute__empty">{t("ready")}</p>
          )}
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
          />
        </div>
      ) : null}

      {error ? <p className="p-stoerung__err">{error}</p> : null}

      <footer className="p-routine__foot">
        <span className="p-stoerung__progress">
          {t("answered", { filled: answeredCount, total: steps.length })}
        </span>
        <div className="p-stoerung__foot-actions">
          <button type="button" className="p-stoerung__cancel" onClick={onCancel} disabled={saving}>
            {t("later")}
          </button>
          {showingNote ? (
            <button
              type="button"
              className="p-routine__save"
              onClick={() => void submit()}
              disabled={saving}
              data-testid="routine-submit"
            >
              {saving ? t("saving") : t("submit")}
            </button>
          ) : (
            <button
              type="button"
              className="p-routine__save"
              onClick={goNext}
              disabled={!step || !answer || !stepDone(step, answer)}
              data-testid="routine-next"
            >
              {onLast ? t("toNote") : t("next")}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
