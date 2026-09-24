"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReclassifyScreenProps } from "@/interfaces";
import { useReclassifyWizard } from "@/components/hooks/registration/useReclassifyWizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { CharacteristicsStep } from "./CharacteristicsStep";
import { DutiesStep } from "./DutiesStep";
import { PrerequisitesStep } from "./PrerequisitesStep";

const STEP_KEYS = ["stepCharacteristics", "stepDuties", "stepPrerequisites"] as const;

/**
 * Admin reclassification — full Merkmale wizard for a DeviceModel.
 * Applies to every inventory copy of the model (with explicit acknowledgement).
 */
export function ReclassifyScreen({ modelId }: ReclassifyScreenProps) {
  const t = useTranslations("registration");
  const tCommon = useTranslations("common");
  const w = useReclassifyWizard(modelId);

  if (w.loading) {
    return (
      <div className="p-work" data-testid="reclassify-loading">
        <main className="p-main">
          <div className="flex items-center gap-2 px-4 py-10 text-sm text-[var(--on-dark-soft)] sm:px-[18px]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tCommon("loading")}
          </div>
        </main>
      </div>
    );
  }

  const ctx = w.context;
  const stepIndex = w.step - 2; // 0..2

  return (
    <div className="p-work" data-testid="reclassify-page">
      <main className="p-main">
        <div className="p-admin p-reg">
          <section className="p-devhead p-admin__head">
            <div className="p-admin__head-copy">
              <h2>{t("reclassifyTitle")}</h2>
              <p className="p-requests__sub">
                {ctx?.displayName ?? modelId}
                {ctx?.manufacturer ? ` · ${ctx.manufacturer}` : ""}
              </p>
            </div>
          </section>

          <div className="p-reg__body" data-testid="reclassify-wizard">
            <div className="p-reg__alert">
              <Alert variant="destructive" data-testid="reclassify-impact-warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t("reclassifyTitle")}</AlertTitle>
                <AlertDescription>
                  {ctx
                    ? `${ctx.copyCount} inventory item${ctx.copyCount === 1 ? "" : "s"} across ${ctx.siteCount} site${ctx.siteCount === 1 ? "" : "s"} (${ctx.releasedCount} released) will receive the new characteristics. Released copies get a new duty freeze; previous duties are suspended.`
                    : t("reclassifyConfirm")}
                </AlertDescription>
              </Alert>
            </div>

            <nav className="p-reg__rail" aria-label={t("reclassifyStepsAria")}>
              {STEP_KEYS.map((key, i) => {
                const n = i + 2;
                const active = w.step === n;
                const label = t(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className="p-reg__step"
                    data-active={active ? "1" : "0"}
                    onClick={() => w.setStep(n)}
                    disabled={i > stepIndex && w.duties.length === 0 && n > 2}
                  >
                    <span className="p-reg__step-num">{i + 1}</span>
                    <span className="p-reg__step-label">{label}</span>
                  </button>
                );
              })}
            </nav>

            {w.error ? (
              <div className="p-reg__alert">
                <Alert variant="destructive" data-testid="reclassify-error">
                  {w.error}
                </Alert>
              </div>
            ) : null}

            {w.step === 2 ? <CharacteristicsStep w={w} /> : null}

            {w.step === 3 ? (
              <DutiesStep
                duties={w.duties}
                decisionProtocol={w.decisionProtocol}
                onBack={() => w.setStep(2)}
                onContinue={() => w.setStep(4)}
              />
            ) : null}

            {w.step === 4 ? (
              <PrerequisitesStep
                prerequisites={w.prerequisites}
                checks={w.checks}
                setChecks={w.setChecks}
                openMandatory={w.openMandatory}
                busy={w.busy}
                onBack={() => w.setStep(3)}
                onRelease={w.release}
                releaseLabel={t("applyCopies")}
                releaseDisabled={!w.acknowledgeImpact}
                title={t("prereqsBeforeApply")}
                readyMessage={t("reclassifyReady")}
                beforeActions={
                  <label
                    className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--navy)]/40 px-3 py-3"
                    data-testid="reclassify-acknowledge"
                  >
                    <Checkbox
                      checked={w.acknowledgeImpact}
                      onCheckedChange={(v) => w.setAcknowledgeImpact(v === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{t("reclassifyConfirm")}</span>
                    </span>
                  </label>
                }
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
