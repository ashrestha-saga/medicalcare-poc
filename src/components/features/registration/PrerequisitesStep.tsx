"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { PrerequisiteItem } from "@/interfaces";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";

export function PrerequisitesStep({
  prerequisites,
  checks,
  setChecks,
  openMandatory,
  busy,
  onBack,
  onRelease,
  releaseLabel,
  releaseDisabled = false,
  beforeActions,
  readyMessage,
  title,
  onUploadEvidence,
  onExternalRef,
}: {
  prerequisites: PrerequisiteItem[];
  checks: Record<string, boolean>;
  setChecks: Dispatch<SetStateAction<Record<string, boolean>>>;
  openMandatory: PrerequisiteItem[];
  busy: boolean;
  onBack: () => void;
  onRelease: () => void;
  releaseLabel?: string;
  releaseDisabled?: boolean;
  beforeActions?: ReactNode;
  readyMessage?: string;
  title?: string;
  /** C2 — upload document evidence for a prerequisite code. */
  onUploadEvidence?: (code: string, file: File) => Promise<void>;
  /** C2 — set external record ref for third_party. */
  onExternalRef?: (code: string, ref: string) => Promise<void>;
}) {
  const t = useTranslations("registration");
  const resolvedTitle = title ?? t("prereqsTitle");
  const resolvedReady = readyMessage ?? t("readyMessage");
  const resolvedRelease = releaseLabel ?? t("createRelease");

  return (
    <section className="p-reg__step-body" data-testid="registration-step-prerequisites">
      <div className="p-reg__card space-y-3">
        <h3 className="p-reg__section">{resolvedTitle}</h3>
        {prerequisites.map((p) => {
          const kind = p.evidenceKind ?? "confirmation";
          const satisfied = Boolean(p.erfuellt || p.evidenceId || checks[p.k]);

          if (kind === "third_party") {
            return (
              <div key={p.k} className={`space-y-1 ${p.erfuellt || p.evidenceId ? "opacity-70" : ""}`}>
                <span className="font-medium">
                  {p.t}
                  {p.pflicht ? <span className="text-[var(--red)]"> *</span> : null}
                  <span className="ml-1 text-xs text-[var(--on-dark-soft)]">
                    (third-party — not self-certifiable)
                  </span>
                </span>
                <span className="block text-xs text-[var(--on-dark-soft)]">
                  {p.g} — {p.n}
                </span>
                {p.evidenceId ? (
                  <span className="block text-xs text-green-700">External evidence recorded</span>
                ) : onExternalRef ? (
                  <input
                    type="text"
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    placeholder="External record / Prüfbericht reference"
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v) void onExternalRef(p.k, v);
                    }}
                  />
                ) : (
                  <Alert variant="destructive">
                    Requires an external record reference before release (level 3).
                  </Alert>
                )}
              </div>
            );
          }

          if (kind === "document") {
            return (
              <div key={p.k} className={`space-y-1 ${satisfied ? "opacity-70" : ""}`}>
                <span className="font-medium">
                  {p.t}
                  {p.pflicht ? <span className="text-[var(--red)]"> *</span> : null}
                </span>
                <span className="block text-xs text-[var(--on-dark-soft)]">
                  {p.g} — {p.n}
                </span>
                {p.evidenceId ? (
                  <span className="block text-xs text-green-700">Document uploaded</span>
                ) : onUploadEvidence ? (
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="mt-1 block text-sm"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUploadEvidence(p.k, file);
                    }}
                  />
                ) : (
                  <label className="mt-1 flex items-start gap-2">
                    <Checkbox
                      checked={Boolean(checks[p.k])}
                      disabled={busy}
                      onCheckedChange={(v) => setChecks((c) => ({ ...c, [p.k]: Boolean(v) }))}
                    />
                    <span className="text-xs">Confirm without upload (level 1 only)</span>
                  </label>
                )}
              </div>
            );
          }

          return (
            <label key={p.k} className={`flex items-start gap-2 ${p.erfuellt ? "opacity-70" : ""}`}>
              <Checkbox
                checked={Boolean(p.erfuellt || checks[p.k])}
                disabled={Boolean(p.erfuellt) || busy}
                onCheckedChange={(v) => setChecks((c) => ({ ...c, [p.k]: Boolean(v) }))}
              />
              <span>
                <span className="font-medium">
                  {p.t}
                  {p.pflicht ? <span className="text-[var(--red)]"> *</span> : null}
                  {p.erfuellt ? (
                    <span className="ml-1 text-xs text-[var(--on-dark-soft)]">{t("fromSiteData")}</span>
                  ) : null}
                </span>
                <span className="block text-xs text-[var(--on-dark-soft)]">
                  {p.g} — {p.n}
                </span>
              </span>
            </label>
          );
        })}
        {openMandatory.length ? (
          <Alert variant="destructive">
            {t("releaseBlocked", { items: openMandatory.map((x) => x.t).join(" · ") })}
          </Alert>
        ) : (
          <Alert>{resolvedReady}</Alert>
        )}
        {beforeActions}
        <div className="p-reg__actions">
          <button type="button" className="p-cta ghost" onClick={onBack}>
            {t("back")}
          </button>
          <button
            type="button"
            className="p-cta"
            onClick={() => void onRelease()}
            disabled={busy || openMandatory.length > 0 || releaseDisabled}
          >
            {resolvedRelease}
          </button>
        </div>
      </div>
    </section>
  );
}
