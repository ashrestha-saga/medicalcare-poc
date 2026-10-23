"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ScanChargeDetailDTO,
  ScanChargeReleaseResultDTO,
  ScanRoutineStepDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type Answer = { passed: boolean | null; measuredValue: string };
type ReleaseKind = "released" | "released_with_conditions" | "rejected";

async function fileToDataUrlAndSha(file: File): Promise<{ dataUrl: string; sha256: string }> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const sha256 = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  return { dataUrl, sha256 };
}

export function ChargeFreigabeForm({
  batchId,
  onCancel,
  onSaved,
}: {
  batchId: string;
  onCancel: () => void;
  onSaved: (result: ScanChargeReleaseResultDTO) => void;
}) {
  const t = useTranslations("scan.charge");
  const [batch, setBatch] = useState<ScanChargeDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [releaseResult, setReleaseResult] = useState<ReleaseKind | null>(null);
  const [releaseNote, setReleaseNote] = useState("");
  const [confirmSign, setConfirmSign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    const res = await api<{ batch: ScanChargeDetailDTO }>(`/api/scan/chargen/${batchId}`);
    setBatch(res.batch);
    const init: Record<string, Answer> = {};
    for (const s of res.batch.perBatchChecks) {
      init[s.checkCode] = { passed: null, measuredValue: "" };
    }
    setAnswers(init);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void reload()
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : t("errLoad"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per batchId
  }, [batchId]);

  const checks = batch?.perBatchChecks ?? [];
  const hurdles = batch?.hurdles ?? [];
  const canReleaseUnconditionally = hurdles.length === 0;

  const hasMangel = useMemo(() => {
    if (!batch) return false;
    return batch.perBatchChecks.some((s) => {
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
  }, [batch, answers]);

  const onBeleg = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { dataUrl, sha256 } = await fileToDataUrlAndSha(file);
      const res = await api<{ batch: ScanChargeDetailDTO }>(`/api/scan/chargen/${batchId}/beleg`, {
        method: "POST",
        body: JSON.stringify({ dataUrl, sha256 }),
      });
      setBatch(res.batch);
      toast.success(t("belegOk"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("errBeleg"));
    } finally {
      setUploading(false);
    }
  };

  const setPass = (step: ScanRoutineStepDTO, passed: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      [step.checkCode]: { passed, measuredValue: "" },
    }));
  };

  const setMeasure = (step: ScanRoutineStepDTO, measuredValue: string) => {
    setAnswers((prev) => ({
      ...prev,
      [step.checkCode]: { passed: null, measuredValue },
    }));
  };

  const submit = async () => {
    if (!batch || !releaseResult) {
      setError(t("errDecision"));
      return;
    }
    if (!confirmSign) {
      setError(t("errSign"));
      return;
    }
    if (releaseResult !== "rejected" && !canReleaseUnconditionally) {
      setError(hurdles[0] ?? t("errHurdles"));
      return;
    }
    if (
      (releaseResult === "rejected" || releaseResult === "released_with_conditions") &&
      !releaseNote.trim()
    ) {
      setError(t("errNote"));
      return;
    }
    if (hasMangel && releaseResult === "released") {
      setError(t("errMangelRelease"));
      return;
    }
    for (const s of checks) {
      const a = answers[s.checkCode];
      if (releaseResult === "rejected") break;
      if (s.kind === "pass_fail" && a?.passed !== true && a?.passed !== false) {
        setError(t("errIncomplete"));
        return;
      }
      if (s.kind === "measure" && !a?.measuredValue.trim()) {
        setError(t("errIncomplete"));
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api<{ result: ScanChargeReleaseResultDTO }>(
        `/api/scan/chargen/${batchId}/release`,
        {
          method: "POST",
          body: JSON.stringify({
            releaseResult,
            releaseNote: releaseNote.trim() || null,
            confirmSign: true,
            answers: checks.map((s) => ({
              checkCode: s.checkCode,
              passed: answers[s.checkCode]?.passed ?? null,
              measuredValue: answers[s.checkCode]?.measuredValue || null,
            })),
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
      <section className="p-routine" data-testid="charge-freigabe-form">
        <p className="p-heute__empty">{t("loading")}</p>
      </section>
    );
  }

  if (!batch) {
    return (
      <section className="p-routine" data-testid="charge-freigabe-form">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <p className="p-heute__empty">{t("errLoad")}</p>
      </section>
    );
  }

  if (batch.releaseResult) {
    return (
      <section className="p-routine" data-testid="charge-freigabe-form">
        <header className="p-routine__head">
          <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
            ×
          </button>
          <h2>{t("freigabeTitle")}</h2>
        </header>
        <p className="p-heute__empty">
          {t("alreadyDone", { result: t(`result.${batch.releaseResult}`) })}
        </p>
        <footer className="p-routine__foot">
          <button type="button" className="p-routine__save" onClick={onCancel}>
            {t("back")}
          </button>
        </footer>
      </section>
    );
  }

  return (
    <section className="p-routine" data-testid="charge-freigabe-form">
      <header className="p-routine__head">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <h2>{t("freigabeTitle")}</h2>
        <p className="p-routine__sub">
          {batch.label} · <span className="mono">{batch.inventoryNumber}</span>
        </p>
        <p className="p-routine__progress">
          {t("batchMeta", { number: batch.batchNumber, programme: batch.programme ?? "—" })}
        </p>
      </header>

      <div className="p-charge__beleg">
        <p className="p-routine__question">{t("beleg")}</p>
        {batch.beleg?.sha256 ? (
          <p className="p-heute__empty mono">
            {t("belegPresent", { sha: batch.beleg.sha256.slice(0, 12) })}
          </p>
        ) : (
          <p className="p-routine__warn">{t("belegMissing")}</p>
        )}
        <label className="p-charge__file">
          <span>{uploading ? t("uploading") : t("belegPick")}</span>
          <input
            type="file"
            accept=".pdf,.md,.txt,.doc,.docx,application/pdf,text/*,image/*"
            disabled={uploading}
            onChange={(e) => void onBeleg(e.target.files?.[0] ?? null)}
            data-testid="charge-beleg-input"
          />
        </label>
      </div>

      {hurdles.length > 0 ? (
        <ul className="p-charge__hurdles" data-testid="charge-hurdles">
          {hurdles.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}

      {checks.map((step) => {
        const a = answers[step.checkCode];
        return (
          <div className="p-routine__step" key={step.checkCode}>
            <p className="p-routine__question">{step.label}</p>
            {step.kind === "pass_fail" ? (
              <div className="p-stoerung__drei">
                <button
                  type="button"
                  className={["p-stoerung__drei-b", a?.passed === true ? "is-on" : ""].join(" ")}
                  data-tone="ok"
                  aria-pressed={a?.passed === true}
                  onClick={() => setPass(step, true)}
                >
                  {t("pass")}
                </button>
                <button
                  type="button"
                  className={["p-stoerung__drei-b", a?.passed === false ? "is-on" : ""].join(" ")}
                  data-tone="stop"
                  aria-pressed={a?.passed === false}
                  onClick={() => setPass(step, false)}
                >
                  {t("defect")}
                </button>
              </div>
            ) : (
              <div className="p-routine__measure">
                <label htmlFor={`ch-${step.checkCode}`}>
                  {t("value")}
                  {step.unit ? ` (${step.unit})` : ""}
                  {step.limitText ? ` · ${step.limitText}` : ""}
                </label>
                <input
                  id={`ch-${step.checkCode}`}
                  inputMode="decimal"
                  value={a?.measuredValue ?? ""}
                  onChange={(e) => setMeasure(step, e.target.value)}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="p-charge__decision">
        <p className="p-routine__question">{t("decision")}</p>
        <div className="p-stoerung__drei">
          {(
            [
              ["released", "ok"],
              ["released_with_conditions", "warn"],
              ["rejected", "stop"],
            ] as const
          ).map(([val, tone]) => (
            <button
              key={val}
              type="button"
              className={["p-stoerung__drei-b", releaseResult === val ? "is-on" : ""].join(" ")}
              data-tone={tone}
              aria-pressed={releaseResult === val}
              disabled={val !== "rejected" && !canReleaseUnconditionally}
              onClick={() => setReleaseResult(val)}
              data-testid={`charge-result-${val}`}
            >
              {t(`result.${val}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-routine__step">
        <label htmlFor="ch-note">{t("note")}</label>
        <textarea
          id="ch-note"
          rows={3}
          value={releaseNote}
          onChange={(e) => setReleaseNote(e.target.value)}
          placeholder={t("notePlaceholder")}
        />
      </div>

      <label className="p-charge__sign">
        <input
          type="checkbox"
          checked={confirmSign}
          onChange={(e) => setConfirmSign(e.target.checked)}
          data-testid="charge-confirm-sign"
        />
        <span>{t("confirmSign")}</span>
      </label>

      {error ? <p className="p-stoerung__err">{error}</p> : null}

      <footer className="p-routine__foot">
        <div className="p-stoerung__foot-actions">
          <button type="button" className="p-stoerung__cancel" onClick={onCancel} disabled={saving}>
            {t("later")}
          </button>
          <button
            type="button"
            className="p-routine__save"
            onClick={() => void submit()}
            disabled={saving || !releaseResult || !confirmSign}
            data-testid="charge-release-submit"
          >
            {saving ? t("saving") : t("sign")}
          </button>
        </div>
      </footer>
    </section>
  );
}
