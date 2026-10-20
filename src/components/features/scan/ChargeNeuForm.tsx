"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ScanChargeDetailDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

function localInputValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ChargeNeuForm({
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
  onSaved: (batch: ScanChargeDetailDTO) => void;
}) {
  const t = useTranslations("scan.charge");
  const [batchNumber, setBatchNumber] = useState("");
  const [programme, setProgramme] = useState("");
  const [loadPattern, setLoadPattern] = useState("");
  const [startedAt, setStartedAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - 45);
    return localInputValue(d);
  });
  const [finishedAt, setFinishedAt] = useState(() => localInputValue());
  const [itemLabel, setItemLabel] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [items, setItems] = useState<{ label: string; quantity: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    const labelTrim = itemLabel.trim();
    if (!labelTrim) {
      setError(t("errItem"));
      return;
    }
    setItems((prev) => [...prev, { label: labelTrim, quantity: Math.max(1, itemQty) }]);
    setItemLabel("");
    setItemQty(1);
    setError(null);
  };

  const submit = async () => {
    if (!batchNumber.trim()) {
      setError(t("errBatchNumber"));
      return;
    }
    if (!programme.trim()) {
      setError(t("errProgramme"));
      return;
    }
    if (items.length === 0) {
      setError(t("errItems"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ batch: ScanChargeDetailDTO }>("/api/scan/chargen", {
        method: "POST",
        body: JSON.stringify({
          equipmentDeviceId: deviceId,
          batchNumber: batchNumber.trim(),
          programme: programme.trim(),
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date(finishedAt).toISOString(),
          loadPattern: loadPattern.trim() || null,
          items,
        }),
      });
      onSaved(res.batch);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("errSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="p-routine" data-testid="charge-neu-form">
      <header className="p-routine__head">
        <button type="button" className="p-close" onClick={onCancel} aria-label={t("cancel")}>
          ×
        </button>
        <h2>{t("neuTitle")}</h2>
        <p className="p-routine__sub">
          {label} · <span className="mono">{inventoryNumber}</span>
        </p>
      </header>

      <div className="p-charge__fields">
        <label>
          {t("batchNumber")}
          <input
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            autoComplete="off"
            data-testid="charge-batch-number"
          />
        </label>
        <label>
          {t("programme")}
          <input
            value={programme}
            onChange={(e) => setProgramme(e.target.value)}
            data-testid="charge-programme"
          />
        </label>
        <label>
          {t("loadPattern")}
          <input value={loadPattern} onChange={(e) => setLoadPattern(e.target.value)} />
        </label>
        <div className="p-charge__times">
          <label>
            {t("startedAt")}
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </label>
          <label>
            {t("finishedAt")}
            <input
              type="datetime-local"
              value={finishedAt}
              onChange={(e) => setFinishedAt(e.target.value)}
            />
          </label>
        </div>

        <div className="p-charge__items">
          <p className="p-routine__question">{t("items")}</p>
          <ul className="p-charge__item-list">
            {items.map((it, i) => (
              <li key={`${it.label}-${i}`}>
                <span>
                  {it.quantity}× {it.label}
                </span>
                <button
                  type="button"
                  className="p-charge__rm"
                  onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={t("removeItem")}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="p-charge__add">
            <input
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              placeholder={t("itemPlaceholder")}
              data-testid="charge-item-label"
            />
            <input
              type="number"
              min={1}
              value={itemQty}
              onChange={(e) => setItemQty(Number(e.target.value) || 1)}
              aria-label={t("quantity")}
            />
            <button type="button" className="p-stoerung__cancel" onClick={addItem}>
              {t("addItem")}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="p-stoerung__err">{error}</p> : null}

      <footer className="p-routine__foot">
        <div className="p-stoerung__foot-actions">
          <button type="button" className="p-stoerung__cancel" onClick={onCancel} disabled={saving}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="p-routine__save"
            onClick={() => void submit()}
            disabled={saving}
            data-testid="charge-neu-submit"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </footer>
    </section>
  );
}
