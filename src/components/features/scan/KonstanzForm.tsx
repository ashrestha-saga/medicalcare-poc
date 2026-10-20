"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ScanKonstanzItemDTO,
  ScanKonstanzOpenDTO,
  ScanKonstanzResultDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type ResultKind = "passed" | "passed_with_conditions" | "failed";

export function KonstanzForm({
  deviceId,
  onCancel,
  onSaved,
}: {
  deviceId: string;
  onCancel: () => void;
  onSaved: (result: ScanKonstanzResultDTO) => void;
}) {
  const t = useTranslations("scan.konstanz");
  const [open, setOpen] = useState<ScanKonstanzOpenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<ResultKind | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ konstanz: ScanKonstanzOpenDTO }>(`/api/scan/devices/${deviceId}/konstanz`)
      .then((res) => {
        if (!alive) return;
        setOpen(res.konstanz);
        setStepIndex(0);
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

  const actionable = (open?.items ?? []).filter((i) => i.canComplete);
  const blocked = (open?.items ?? []).filter((i) => !i.canComplete);
  const item: ScanKonstanzItemDTO | undefined = actionable[stepIndex];

  const submit = async () => {
    if (!open || !item || !result) {
      setError(t("errResult"));
      return;
    }
    if ((result === "failed" || result === "passed_with_conditions") && !note.trim()) {
      setError(t("errNote"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ result: ScanKonstanzResultDTO }>(
        `/api/scan/devices/${deviceId}/konstanz`,
        {
          method: "POST",
          body: JSON.stringify({
            dutyId: item.dutyId,
            result,
            note: note.trim() || null,
            performedAt: open.performedAt,
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
      <section className="p-routine" data-testid="konstanz-form">
        <p className="p-heute__empty">{t("loading")}</p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="p-routine" data-testid="konstanz-form">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <p className="p-heute__empty">{t("errLoad")}</p>
      </section>
    );
  }

  if (actionable.length === 0) {
    return (
      <section className="p-routine" data-testid="konstanz-form">
        <header className="p-routine__head">
          <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
            ×
          </button>
          <h2>{t("title")}</h2>
          <p className="p-routine__sub">
            {open.label} · <span className="mono">{open.inventoryNumber}</span>
          </p>
        </header>
        {blocked.length > 0 ? (
          <ul className="p-charge__hurdles">
            {blocked.map((b) => (
              <li key={b.dutyId}>
                {b.title}: {t(`status.${b.status}`)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-heute__empty">{t("allDone")}</p>
        )}
        <footer className="p-routine__foot">
          <button type="button" className="p-routine__save" onClick={onCancel}>
            {t("back")}
          </button>
        </footer>
      </section>
    );
  }

  return (
    <section className="p-routine" data-testid="konstanz-form">
      <header className="p-routine__head">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <h2>{t("title")}</h2>
        <p className="p-routine__sub">
          {open.label} · <span className="mono">{open.inventoryNumber}</span>
        </p>
        <p className="p-routine__progress">
          {t("progress", { current: stepIndex + 1, total: actionable.length })}
        </p>
      </header>

      {item ? (
        <div className="p-routine__step" key={item.dutyId}>
          <p className="p-routine__question">{item.title}</p>
          <p className="p-routine__scope">
            {t(`status.${item.status}`)}
            {item.dueAt ? ` · ${t("dueAt", { date: item.dueAt })}` : ""}
          </p>
          {item.constancyObjectLabel ? (
            <p className="p-heute__empty">{item.constancyObjectLabel}</p>
          ) : null}

          <div className="p-stoerung__drei">
            {(
              [
                ["passed", "ok"],
                ["passed_with_conditions", "warn"],
                ["failed", "stop"],
              ] as const
            ).map(([val, tone]) => (
              <button
                key={val}
                type="button"
                className={["p-stoerung__drei-b", result === val ? "is-on" : ""].join(" ")}
                data-tone={tone}
                aria-pressed={result === val}
                onClick={() => {
                  setResult(val);
                  setError(null);
                }}
                data-testid={`konstanz-result-${val}`}
              >
                {t(`result.${val}`)}
              </button>
            ))}
          </div>

          <label htmlFor="kz-note" className="p-routine__measure">
            {result === "failed" || result === "passed_with_conditions"
              ? t("noteRequired")
              : t("noteOptional")}
          </label>
          <textarea
            id="kz-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
          />
        </div>
      ) : null}

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
            disabled={saving || !result}
            data-testid="konstanz-submit"
          >
            {saving ? t("saving") : t("submit")}
          </button>
        </div>
      </footer>
    </section>
  );
}
