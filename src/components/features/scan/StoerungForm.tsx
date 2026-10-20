"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScanStoerungResultDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type Kind = "malfunction" | "operating_error" | "note";
type Tri = "yes" | "no" | "unknown";
type Duo = "yes" | "no";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function TriButtons<T extends string>({
  name,
  value,
  options,
  onChange,
  error,
}: {
  name: string;
  value: T | null;
  options: { value: T; label: string; tone: string }[];
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <div className="p-stoerung__fld" data-err={error ? "1" : undefined}>
      <div className="p-stoerung__drei" role="group" aria-label={name}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={["p-stoerung__drei-b", value === o.value ? "is-on" : ""].filter(Boolean).join(" ")}
            data-tone={o.tone}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error ? <p className="p-stoerung__err">{error}</p> : null}
    </div>
  );
}

export function StoerungForm({
  deviceId,
  inventoryNumber,
  label,
  onCancel,
  onSaved,
}: {
  deviceId: string;
  inventoryNumber: string;
  label: string;
  onCancel: () => void;
  onSaved: (result: ScanStoerungResultDTO) => void;
}) {
  const t = useTranslations("scan.stoerung");
  const [kind, setKind] = useState<Kind | null>(null);
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [harm, setHarm] = useState<Tri | null>(null);
  const [outOfService, setOutOfService] = useState<Duo | null>(null);
  const [consequence, setConsequence] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filled = useMemo(() => {
    let n = 0;
    if (kind) n++;
    if (description.trim().length >= 10) n++;
    if (harm) n++;
    if (outOfService) n++;
    return n;
  }, [kind, description, harm, outOfService]);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!kind) err.kind = t("errKind");
    if (!occurredAt || occurredAt > todayIso()) err.occurredAt = t("errDate");
    if (description.trim().length < 10) err.description = t("errDescription");
    if (!harm) err.harm = t("errHarm");
    if (!outOfService) err.outOfService = t("errOut");
    if (harm === "yes" && outOfService === "no" && !consequence.trim()) {
      err.consequence = t("errConsequence");
    }
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async () => {
    if (!validate() || !kind || !harm || !outOfService) return;
    setSaving(true);
    try {
      const res = await api<{ result: ScanStoerungResultDTO }>("/api/scan/stoerung", {
        method: "POST",
        body: JSON.stringify({
          deviceInstanceId: deviceId,
          kind,
          occurredAt,
          description: description.trim(),
          harm,
          outOfService,
          consequence: consequence.trim() || null,
        }),
      });
      onSaved(res.result);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("errSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="p-stoerung" data-testid="stoerung-form">
      <header className="p-stoerung__head">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <h2>{t("title")}</h2>
        <p className="p-stoerung__sub">
          {label} · <span className="mono">{inventoryNumber}</span>
        </p>
      </header>

      <div className="p-stoerung__body">
        <label className="p-stoerung__label">{t("kind")}</label>
        <TriButtons
          name={t("kind")}
          value={kind}
          onChange={setKind}
          error={fieldErrors.kind}
          options={[
            { value: "malfunction", label: t("kindMalfunction"), tone: "stop" },
            { value: "operating_error", label: t("kindOperating"), tone: "warn" },
            { value: "note", label: t("kindNote"), tone: "none" },
          ]}
        />

        <label className="p-stoerung__label" htmlFor="st-datum">
          {t("noticed")}
        </label>
        <div className="p-stoerung__fld" data-err={fieldErrors.occurredAt ? "1" : undefined}>
          <input
            id="st-datum"
            type="date"
            max={todayIso()}
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
          {fieldErrors.occurredAt ? <p className="p-stoerung__err">{fieldErrors.occurredAt}</p> : null}
        </div>

        <label className="p-stoerung__label" htmlFor="st-was">
          {t("what")}
        </label>
        <div className="p-stoerung__fld" data-err={fieldErrors.description ? "1" : undefined}>
          <textarea
            id="st-was"
            rows={3}
            placeholder={t("whatPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {fieldErrors.description ? <p className="p-stoerung__err">{fieldErrors.description}</p> : null}
        </div>

        <label className="p-stoerung__label">{t("harm")}</label>
        <p className="p-stoerung__hint">{t("harmHint")}</p>
        <TriButtons
          name={t("harm")}
          value={harm}
          onChange={setHarm}
          error={fieldErrors.harm}
          options={[
            { value: "yes", label: t("yes"), tone: "stop" },
            { value: "no", label: t("no"), tone: "ok" },
            { value: "unknown", label: t("unknown"), tone: "warn" },
          ]}
        />

        <label className="p-stoerung__label">{t("outOfService")}</label>
        <TriButtons
          name={t("outOfService")}
          value={outOfService}
          onChange={setOutOfService}
          error={fieldErrors.outOfService}
          options={[
            { value: "yes", label: t("outYes"), tone: "stop" },
            { value: "no", label: t("outNo"), tone: "ok" },
          ]}
        />

        <label className="p-stoerung__label" htmlFor="st-folge">
          {t("consequence")}
        </label>
        {harm === "yes" && outOfService === "no" ? (
          <p className="p-stoerung__hint p-stoerung__hint--warn">{t("consequenceWarn")}</p>
        ) : null}
        <div className="p-stoerung__fld" data-err={fieldErrors.consequence ? "1" : undefined}>
          <textarea
            id="st-folge"
            rows={2}
            placeholder={t("consequencePlaceholder")}
            value={consequence}
            onChange={(e) => setConsequence(e.target.value)}
          />
          {fieldErrors.consequence ? <p className="p-stoerung__err">{fieldErrors.consequence}</p> : null}
        </div>
      </div>

      <footer className="p-stoerung__foot">
        <span className="p-stoerung__progress">{t("progress", { filled, total: 4 })}</span>
        <div className="p-stoerung__foot-actions">
          <button type="button" className="p-stoerung__cancel" onClick={onCancel} disabled={saving}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="p-stoerung__save"
            onClick={() => void submit()}
            disabled={saving || filled < 4}
            data-testid="stoerung-submit"
          >
            {saving ? t("saving") : t("submit")}
          </button>
        </div>
      </footer>
    </section>
  );
}
