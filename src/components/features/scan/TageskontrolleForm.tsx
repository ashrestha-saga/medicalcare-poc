"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ScanRoutineCompletedItemDTO,
  ScanRoutineOpenDTO,
  ScanRoutineResultDTO,
  ScanRoutineStepDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type Answer = { passed: boolean | null; measuredValue: string };

function formatCompletedValue(
  item: ScanRoutineCompletedItemDTO,
  t: (key: string) => string,
): string {
  if (item.kind === "measure") {
    const raw = item.measuredValue?.trim() || "—";
    const withUnit = item.unit ? `${raw} ${item.unit}` : raw;
    if (item.withinLimit === true) return `${withUnit} · ${t("withinLimit")}`;
    if (item.withinLimit === false) return `${withUnit} · ${t("outsideLimit")}`;
    return withUnit;
  }
  if (item.passed === true) return t("ok");
  if (item.passed === false) return t("defect");
  return "—";
}

function formatRecordedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

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
  const [showNoteStep, setShowNoteStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setShowNoteStep(false);
    setStepIndex(0);
    setNote("");
    setError(null);
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
      return;
    }
    // Last check: only leave the measure/pass UI after an explicit continue.
    setShowNoteStep(true);
    setError(null);
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
    const completed = open.completedToday ?? [];
    const performers = [
      ...new Set(completed.map((c) => c.performedBy?.trim()).filter(Boolean) as string[]),
    ];
    const latestAt = completed.reduce<string | null>((acc, c) => {
      if (!acc || c.recordedAt > acc) return c.recordedAt;
      return acc;
    }, null);
    const hasMangelDone = completed.some(
      (c) => c.passed === false || c.withinLimit === false,
    );

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
        {completed.length > 0 ? (
          <div className="p-routine__done" data-testid="routine-completed-today">
            <p className="p-routine__done-meta">
              {t("completedMeta", {
                date: open.performedAt,
                by: performers.length ? performers.join(", ") : t("completedByUnknown"),
                when: latestAt ? formatRecordedAt(latestAt) : "—",
              })}
            </p>
            <dl className="p-routine__done-list">
              {completed.map((item) => {
                const tone =
                  item.passed === false || item.withinLimit === false ? "stop" : "ok";
                const scopeLabel =
                  item.scope === "equipment"
                    ? null
                    : open.siteName
                      ? t("siteScope", { site: open.siteName })
                      : item.scope === "water"
                        ? t("scope.water")
                        : item.scope === "chemistry"
                          ? t("scope.chemistry")
                          : item.scope === "sterile_storage"
                            ? t("scope.sterile_storage")
                            : null;
                return (
                  <div
                    key={item.checkCode}
                    className="p-routine__done-row"
                    data-t={tone}
                    data-testid={`routine-completed-${item.checkCode}`}
                  >
                    <dt>
                      {item.label}
                      {scopeLabel ? (
                        <span className="p-routine__done-scope">{scopeLabel}</span>
                      ) : null}
                    </dt>
                    <dd>{formatCompletedValue(item, t)}</dd>
                    {item.note?.trim() ? (
                      <p className="p-routine__done-note">{item.note.trim()}</p>
                    ) : null}
                  </div>
                );
              })}
            </dl>
            {hasMangelDone ? <p className="p-routine__warn">{t("hintMangel")}</p> : null}
          </div>
        ) : null}
        <footer className="p-routine__foot">
          <button
            type="button"
            className="p-routine__back"
            onClick={onCancel}
            data-testid="routine-completed-back"
          >
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

      {step && !showNoteStep ? (
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

      {showNoteStep ? (
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
          {showNoteStep ? (
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
