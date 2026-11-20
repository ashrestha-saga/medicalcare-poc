"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScanDguvOpenDTO, ScanDguvResultDTO } from "@/interfaces";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type ResultKind = "passed" | "failed";
type ConfirmKind = "leave" | "fail" | "overdue-pass" | null;

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
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

function withinFromLimitText(limitText: string | null | undefined, measured: string): boolean | null {
  if (!limitText || measured.trim() === "") return null;
  const v = parseFloat(measured.replace(",", "."));
  if (Number.isNaN(v)) return null;
  const le = limitText.match(/[≤<=]\s*([\d.,]+)/);
  if (le?.[1]) return v <= parseFloat(le[1].replace(",", "."));
  const ge = limitText.match(/[≥>=]\s*([\d.,]+)/);
  if (ge?.[1]) return v >= parseFloat(ge[1].replace(",", "."));
  return null;
}

function withinForMeasurement(
  value: number | null,
  unit: string,
  limit: number | null,
  limitText: string | null,
): boolean | null {
  if (value == null || Number.isNaN(value)) return null;
  const fromText = withinFromLimitText(limitText, String(value));
  if (fromText != null) return fromText;
  if (limit == null) return null;
  const u = unit.toLowerCase();
  if (u.includes("mohm") || u.includes("mω") || u.includes("mΩ".toLowerCase())) {
    return value >= limit;
  }
  return value <= limit;
}

function skTone(sk: string | null): "sk1" | "sk2" | "sk3" | "neutral" {
  if (sk === "I") return "sk1";
  if (sk === "II") return "sk2";
  if (sk === "III") return "sk3";
  return "neutral";
}

export function DguvOwnCheckForm({
  deviceId,
  onCancel,
  onSaved,
}: {
  deviceId: string;
  onCancel: () => void;
  onSaved: (result: ScanDguvResultDTO) => void;
}) {
  const t = useTranslations("scan.dguv");
  const [open, setOpen] = useState<ScanDguvOpenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultKind | null>(null);
  const [labelNumber, setLabelNumber] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ dguv: ScanDguvOpenDTO }>(`/api/scan/devices/${deviceId}/dguv`)
      .then((res) => {
        if (!alive) return;
        setOpen(res.dguv);
        const init: Record<string, string> = {};
        for (const m of res.dguv.measurements) init[m.name] = "";
        setValues(init);
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

  const measurements = useMemo(() => {
    if (!open) return [];
    return open.measurements.map((m) => {
      const raw = values[m.name] ?? "";
      const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
      const within =
        parsed == null || Number.isNaN(parsed)
          ? null
          : withinForMeasurement(parsed, m.unit, m.limit, m.limitText);
      return { ...m, raw, value: parsed, within };
    });
  }, [open, values]);

  const anyOut = measurements.some((m) => m.within === false);
  const allFilled = measurements.every(
    (m) => m.value != null && !Number.isNaN(m.value),
  );
  const isOverdue = open?.status === "overdue";
  const isDue = open?.status === "due";
  const pending = Boolean(open && (isOverdue || isDue) && !open.completedToday);

  useEffect(() => {
    if (anyOut && result === "passed") setResult("failed");
  }, [anyOut, result]);

  const doSubmit = async () => {
    if (!open || !result) return;
    setSaving(true);
    setError(null);
    setConfirm(null);
    try {
      const res = await api<{ result: ScanDguvResultDTO }>(
        `/api/scan/devices/${deviceId}/dguv`,
        {
          method: "POST",
          body: JSON.stringify({
            dutyId: open.dutyId,
            result,
            labelNumber: result === "passed" ? labelNumber.trim() : null,
            measurements: measurements.map((m) => ({
              name: m.name,
              value: m.value!,
              unit: m.unit || "—",
              limit: m.limit,
              withinLimit: m.within !== false,
            })),
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

  const validate = (): boolean => {
    if (!allFilled) {
      setError(t("errMeasurements"));
      return false;
    }
    if (!result) {
      setError(t("errResult"));
      return false;
    }
    if (result === "passed" && !/^[A-Z]{2}-\d{4}-\d{4}$/.test(labelNumber.trim())) {
      setError(t("errLabel"));
      return false;
    }
    if (result === "failed" && !note.trim()) {
      setError(t("errNote"));
      return false;
    }
    setError(null);
    return true;
  };

  const requestSubmit = () => {
    if (!validate()) return;
    if (result === "failed") {
      setConfirm("fail");
      return;
    }
    if (isOverdue && result === "passed") {
      setConfirm("overdue-pass");
      return;
    }
    void doSubmit();
  };

  const requestLeave = () => {
    if (pending && (dirty || !result)) {
      setConfirm("leave");
      return;
    }
    onCancel();
  };

  if (loading) {
    return (
      <section className="p-routine p-dguv" data-testid="dguv-form">
        <p className="p-heute__empty">{t("loading")}</p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="p-routine p-dguv" data-testid="dguv-form">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <p className="p-heute__empty">{t("errLoad")}</p>
      </section>
    );
  }

  const statusTone = isOverdue ? "stop" : isDue ? "warn" : "ok";

  if (open.completedToday || open.status === "ok") {
    const done = open.completedToday;
    const tone = done?.result === "failed" ? "stop" : "ok";
    return (
      <section className="p-routine p-done p-dguv" data-testid="dguv-form">
        <header className="p-routine__head p-dguv__head">
          <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
            ×
          </button>
          <h2>{t("title")}</h2>
          <p className="p-routine__sub">
            {open.label}
            <span className="p-done__inv mono">{open.inventoryNumber}</span>
          </p>
        </header>

        <div className="p-done__banner" data-t={tone} data-testid="dguv-status-banner">
          <span className="p-done__banner-dot" aria-hidden />
          <div className="p-done__banner-text">
            <strong>{done ? t("allDoneToday") : t("allDone")}</strong>
            {done ? <span>{formatDay(open.performedAt)}</span> : null}
            {!done && open.dueAt ? (
              <span>{t("dueAt", { date: formatDay(open.dueAt) })}</span>
            ) : null}
          </div>
        </div>

        {done ? (
          <div className="p-done__list" data-testid="dguv-completed-today">
            <article className="p-done__card" data-t={tone}>
              <div className="p-done__card-top">
                <div className="p-done__card-titles">
                  <h3>{open.title}</h3>
                  {open.protectionClass ? (
                    <p className="p-done__object">
                      {t("protectionClass", { value: open.protectionClass })}
                    </p>
                  ) : null}
                </div>
                <span className="p-done__pill" data-t={tone}>
                  {t(`result.${done.result}`)}
                </span>
              </div>
              <div className="p-done__meta">
                <div className="p-done__meta-item">
                  <span className="p-done__meta-k">{t("performedAt")}</span>
                  <span className="p-done__meta-v">{formatRecordedAt(done.performedAt)}</span>
                </div>
                <div className="p-done__meta-item">
                  <span className="p-done__meta-k">{t("performedBy")}</span>
                  <span className="p-done__meta-v">{done.performedBy || t("completedByUnknown")}</span>
                </div>
                {done.labelNumber ? (
                  <div className="p-done__meta-item">
                    <span className="p-done__meta-k">{t("labelNumber")}</span>
                    <span className="p-done__meta-v mono">{done.labelNumber}</span>
                  </div>
                ) : null}
                {done.nextDueAt ? (
                  <div className="p-done__meta-item">
                    <span className="p-done__meta-k">{t("nextDue")}</span>
                    <span className="p-done__meta-v">{formatDay(done.nextDueAt)}</span>
                  </div>
                ) : null}
              </div>
            </article>
            {done.result === "failed" ? <p className="p-routine__warn">{t("hintFailed")}</p> : null}
          </div>
        ) : null}

        <footer className="p-routine__foot">
          <button
            type="button"
            className="p-routine__save"
            onClick={onCancel}
            data-testid="dguv-completed-back"
          >
            {t("back")}
          </button>
        </footer>
      </section>
    );
  }

  return (
    <section
      className="p-routine p-dguv"
      data-testid="dguv-form"
      data-status={open.status}
    >
      <header className="p-routine__head p-dguv__head">
        <button type="button" className="p-close" onClick={requestLeave} aria-label={t("cancel")}>
          ×
        </button>
        <h2>{t("title")}</h2>
        <p className="p-routine__sub">
          {open.label} · <span className="mono">{open.inventoryNumber}</span>
        </p>

        <div className="p-dguv__chips" role="list" aria-label={t("metaAria")}>
          <span className="p-dguv__chip" data-t={statusTone} role="listitem">
            <span className="p-dguv__chip-dot" aria-hidden />
            {t(`status.${open.status}`)}
          </span>
          {open.dueAt ? (
            <span className="p-dguv__chip" data-t={statusTone} role="listitem">
              <span className="p-dguv__chip-k">{t("dueLabel")}</span>
              <span className="p-dguv__chip-v mono">{formatDay(open.dueAt)}</span>
            </span>
          ) : null}
          {open.protectionClass ? (
            <span
              className="p-dguv__chip p-dguv__chip--sk"
              data-sk={skTone(open.protectionClass)}
              role="listitem"
            >
              <span className="p-dguv__chip-k">{t("skLabel")}</span>
              <span className="p-dguv__chip-v">{open.protectionClass}</span>
            </span>
          ) : null}
          {open.gbuRef ? (
            <span className="p-dguv__chip p-dguv__chip--gbu" role="listitem">
              <span className="p-dguv__chip-k">GBU</span>
              <span className="p-dguv__chip-v mono">{open.gbuRef.replace(/^GBU\s*[·•-]?\s*/i, "")}</span>
            </span>
          ) : null}
        </div>
      </header>

      {isOverdue ? (
        <div className="p-dguv__alert" data-t="stop" data-testid="dguv-overdue-banner">
          <strong>{t("overdueTitle")}</strong>
          <span>{t("overdueBody", { date: formatDay(open.dueAt) })}</span>
        </div>
      ) : isDue ? (
        <div className="p-dguv__alert" data-t="warn" data-testid="dguv-due-banner">
          <strong>{t("dueTitle")}</strong>
          <span>{t("dueBody")}</span>
        </div>
      ) : null}

      <div className="p-routine__step p-dguv__body">
        <p className="p-routine__question">{open.title}</p>

        <ul className="p-dguv__measures" data-testid="dguv-measurements">
          {measurements.map((m) => {
            const tone = m.within === false ? "stop" : m.within === true ? "ok" : undefined;
            return (
              <li key={m.name} className="p-dguv__measure" data-t={tone}>
                <div className="p-dguv__measure-top">
                  <label htmlFor={`dguv-m-${m.name}`}>{m.name}</label>
                  {tone ? (
                    <span className="p-done__pill" data-t={tone}>
                      {tone === "stop" ? t("outOfLimit") : t("withinLimit")}
                    </span>
                  ) : null}
                </div>
                {m.limitText ? <p className="p-dguv__limit">{m.limitText}</p> : null}
                <div className="p-dguv__input-row">
                  <input
                    id={`dguv-m-${m.name}`}
                    type="text"
                    inputMode="decimal"
                    value={m.raw}
                    onChange={(e) => {
                      setDirty(true);
                      setValues((prev) => ({ ...prev, [m.name]: e.target.value }));
                    }}
                    placeholder="0"
                    data-testid={`dguv-measure-${m.name}`}
                    aria-invalid={m.within === false}
                  />
                  <span className="p-dguv__unit mono">{m.unit || "—"}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="p-dguv__result" role="group" aria-label={t("resultAria")}>
          {(
            [
              ["passed", "ok"],
              ["failed", "stop"],
            ] as const
          ).map(([val, tone]) => (
            <button
              key={val}
              type="button"
              className={["p-dguv__result-b", result === val ? "is-on" : ""].join(" ")}
              data-tone={tone}
              aria-pressed={result === val}
              disabled={val === "passed" && anyOut}
              onClick={() => {
                setDirty(true);
                setResult(val);
                setError(null);
              }}
              data-testid={`dguv-result-${val}`}
            >
              {t(`result.${val}`)}
            </button>
          ))}
        </div>

        {result === "passed" ? (
          <div className="p-dguv__field">
            <label htmlFor="dguv-label">{t("labelNumber")}</label>
            <input
              id="dguv-label"
              className="mono"
              value={labelNumber}
              onChange={(e) => {
                setDirty(true);
                setLabelNumber(e.target.value.toUpperCase());
              }}
              placeholder={t("labelPlaceholder")}
              data-testid="dguv-label-number"
              autoComplete="off"
            />
            <p className="p-dguv__hint">{t("labelHint")}</p>
          </div>
        ) : null}

        <div className="p-dguv__field">
          <label htmlFor="dguv-note">
            {result === "failed" ? t("noteRequired") : t("noteOptional")}
          </label>
          <textarea
            id="dguv-note"
            rows={3}
            value={note}
            onChange={(e) => {
              setDirty(true);
              setNote(e.target.value);
            }}
            placeholder={t("notePlaceholder")}
          />
        </div>
      </div>

      {error ? <p className="p-stoerung__err p-dguv__err">{error}</p> : null}

      <footer className="p-routine__foot">
        <div className="p-stoerung__foot-actions">
          <button
            type="button"
            className="p-stoerung__cancel"
            onClick={requestLeave}
            disabled={saving}
            data-testid="dguv-later"
          >
            {t("later")}
          </button>
          <button
            type="button"
            className="p-routine__save"
            data-tone={result === "failed" ? "stop" : undefined}
            onClick={requestSubmit}
            disabled={saving || !result || !allFilled}
            data-testid="dguv-submit"
          >
            {saving ? t("saving") : t("submit")}
          </button>
        </div>
      </footer>

      <AlertDialog
        open={confirm != null}
        onOpenChange={(next) => {
          if (!next && !saving) setConfirm(null);
        }}
      >
        <AlertDialogContent data-testid="dguv-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "leave"
                ? t("confirmLeaveTitle")
                : confirm === "fail"
                  ? t("confirmFailTitle")
                  : t("confirmOverduePassTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "leave"
                ? t("confirmLeaveBody", { date: formatDay(open.dueAt) })
                : confirm === "fail"
                  ? t("confirmFailBody")
                  : t("confirmOverduePassBody", { date: formatDay(open.dueAt) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} data-testid="dguv-confirm-cancel">
              {t("confirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className={
                confirm === "fail" || confirm === "leave"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                if (confirm === "leave") {
                  setConfirm(null);
                  onCancel();
                  return;
                }
                void doSubmit();
              }}
              data-testid="dguv-confirm-ok"
            >
              {confirm === "leave"
                ? t("confirmLeaveOk")
                : confirm === "fail"
                  ? t("confirmFailOk")
                  : t("confirmOverduePassOk")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
