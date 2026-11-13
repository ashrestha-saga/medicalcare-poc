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

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

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

function formatCompletedPill(
  item: ScanRoutineCompletedItemDTO,
  t: (key: string) => string,
): string {
  if (item.kind === "measure") {
    if (item.withinLimit === true) return t("withinLimit");
    if (item.withinLimit === false) return t("outsideLimit");
    return t("recorded");
  }
  if (item.passed === true) return t("ok");
  if (item.passed === false) return t("defect");
  return "—";
}

function completedTone(item: ScanRoutineCompletedItemDTO): "ok" | "warn" | "stop" {
  if (item.passed === false || item.withinLimit === false) return "stop";
  if (item.kind === "measure" && item.withinLimit == null && item.measuredValue) return "warn";
  return "ok";
}

function formatRecordedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    const day = formatDay(d.toISOString());
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${time}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export function TageskontrolleForm({
  deviceId,
  siteId,
  onCancel,
  onSaved,
}: {
  /** Inventory device pack (equipment dailies). */
  deviceId?: string;
  /** Site / Haus pack (water, chemistry, sterile) — mutually exclusive with deviceId. */
  siteId?: string;
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
  const isSite = Boolean(siteId);
  const endpoint = siteId
    ? `/api/scan/sites/${siteId}/routine`
    : deviceId
      ? `/api/scan/devices/${deviceId}/routine`
      : null;

  useEffect(() => {
    let alive = true;
    if (!endpoint) {
      setLoading(false);
      setOpen(null);
      return;
    }
    setLoading(true);
    setShowNoteStep(false);
    setStepIndex(0);
    setNote("");
    setError(null);
    void api<{ routine: ScanRoutineOpenDTO }>(endpoint)
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
  }, [endpoint, t]);

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
    if (!endpoint) return;
    setSaving(true);
    try {
      const res = await api<{ result: ScanRoutineResultDTO }>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          answers: open.steps.map((s) => ({
            checkCode: s.checkCode,
            passed: answers[s.checkCode]?.passed ?? null,
            measuredValue: answers[s.checkCode]?.measuredValue || null,
          })),
          note: note.trim() || null,
        }),
      });
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
    const hasMangelDone = completed.some(
      (c) => c.passed === false || c.withinLimit === false,
    );
    const hasUnevaluated = completed.some(
      (c) => c.kind === "measure" && c.withinLimit == null && Boolean(c.measuredValue),
    );
    const summaryTone = hasMangelDone
      ? "stop"
      : hasUnevaluated
        ? "warn"
        : completed.length > 0
          ? "ok"
          : "idle";
    const isSiteSubject = isSite || open.subjectKind === "site";

    return (
      <section className="p-routine p-done" data-testid="tageskontrolle-form">
        <header className="p-routine__head">
          <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
            ×
          </button>
          <h2>{isSiteSubject ? t("titleSite") : t("title")}</h2>
          <p className="p-routine__sub">
            {isSiteSubject ? (
              <>
                {t("siteSubject")}
                <span className="p-done__inv mono">{open.siteName ?? open.label}</span>
              </>
            ) : (
              <>
                {open.label}
                <span className="p-done__inv mono">{open.inventoryNumber}</span>
              </>
            )}
          </p>
        </header>

        <div className="p-done__banner" data-t={summaryTone} data-testid="routine-status-banner">
          <span className="p-done__banner-dot" aria-hidden />
          <div className="p-done__banner-text">
            <strong>
              {completed.length > 0
                ? t("allDoneToday")
                : isSiteSubject
                  ? t("allDoneSite")
                  : t("allDone")}
            </strong>
            {completed.length > 0 ? (
              <span>
                {t("completedCount", { count: completed.length })} · {formatDay(open.performedAt)}
              </span>
            ) : null}
          </div>
        </div>

        {completed.length > 0 ? (
          <div className="p-done__list" data-testid="routine-completed-today">
            {completed.map((item) => {
              const tone = completedTone(item);
              const scopeLabel =
                item.scope === "equipment"
                  ? t("scope.equipment")
                  : open.siteName
                    ? t("siteScope", { site: open.siteName })
                    : item.scope === "water"
                      ? t("scope.water")
                      : item.scope === "chemistry"
                        ? t("scope.chemistry")
                        : item.scope === "sterile_storage"
                          ? t("scope.sterile_storage")
                          : null;
              const valueLine =
                item.kind === "measure"
                  ? formatCompletedValue(item, t)
                  : null;
              return (
                <article
                  key={item.checkCode}
                  className="p-done__card"
                  data-t={tone}
                  data-testid={`routine-completed-${item.checkCode}`}
                >
                  <div className="p-done__card-top">
                    <div className="p-done__card-titles">
                      <h3>{item.label}</h3>
                      {scopeLabel ? <p className="p-done__object">{scopeLabel}</p> : null}
                    </div>
                    <span className="p-done__pill" data-t={tone}>
                      {formatCompletedPill(item, t)}
                    </span>
                  </div>

                  <div className="p-done__meta">
                    {valueLine ? (
                      <div className="p-done__meta-item p-done__meta-item--wide">
                        <span className="p-done__meta-k">{t("value")}</span>
                        <span className="p-done__meta-v">{valueLine}</span>
                      </div>
                    ) : null}
                    <div className="p-done__meta-item">
                      <span className="p-done__meta-k">{t("performedAt")}</span>
                      <span className="p-done__meta-v">{formatRecordedAt(item.recordedAt)}</span>
                    </div>
                    <div className="p-done__meta-item">
                      <span className="p-done__meta-k">{t("performedBy")}</span>
                      <span className="p-done__meta-v">
                        {item.performedBy?.trim() || t("completedByUnknown")}
                      </span>
                    </div>
                  </div>

                  {item.note?.trim() ? (
                    <p className="p-done__note">{item.note.trim()}</p>
                  ) : null}
                </article>
              );
            })}
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
        <h2>{isSite || open.subjectKind === "site" ? t("titleSite") : t("title")}</h2>
        <p className="p-routine__sub">
          {open.subjectKind === "site" ? (
            <>
              {t("siteSubject")} · <span className="mono">{open.siteName ?? open.label}</span>
            </>
          ) : (
            <>
              {open.label} · <span className="mono">{open.inventoryNumber}</span>
            </>
          )}
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
