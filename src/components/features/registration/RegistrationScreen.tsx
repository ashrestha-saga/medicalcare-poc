"use client";

import { useTranslations } from "next-intl";
import type { RegistrationScreenProps } from "@/interfaces";
import { useRegistrationWizard } from "@/components/hooks/registration/useRegistrationWizard";
import { Alert } from "@/components/ui/alert";
import { RegistrationStepRail } from "./RegistrationStepRail";
import { ProductIdentityStep } from "./ProductIdentityStep";
import { CharacteristicsStep } from "./CharacteristicsStep";
import { DutiesStep } from "./DutiesStep";
import { PrerequisitesStep } from "./PrerequisitesStep";

/**
 * Full-width Erstanlage screen — same shell as Inventory / Locations (`p-work` / `p-admin`).
 */
export function RegistrationScreen({ draftId }: RegistrationScreenProps) {
  const t = useTranslations("registration");
  const w = useRegistrationWizard(draftId);

  return (
    <div className="p-work" data-testid="registration-page">
      <main className="p-main">
        <div className="p-admin p-reg">
          <section className="p-devhead p-admin__head">
            <div className="p-admin__head-copy">
              <h2>{t("title")}</h2>
              <p className="p-requests__sub">{t("subtitle")}</p>
            </div>
          </section>

          <div className="p-reg__body" data-testid="registration-wizard">
            <RegistrationStepRail
              step={w.step}
              maxStep={w.maxStep}
              characteristicsSkipped={w.characteristicsSkipped}
              catalogLinkMode={w.catalogLinkMode}
              onSelect={w.setStep}
            />

            {w.error ? (
              <div className="p-reg__alert">
                <Alert variant="destructive" data-testid="registration-error">
                  {w.error}
                </Alert>
              </div>
            ) : null}

            {w.step === 1 ? (
              <ProductIdentityStep
                form={w.form}
                patchForm={w.patchForm}
                sites={w.sites}
                areas={w.areas}
                fieldErrors={w.fieldErrors}
                busy={w.busy}
                identityPhase={w.identityPhase}
                linkedModelId={w.linkedModelId}
                hasClassificationPrefill={w.hasClassificationPrefill}
                gtinInput={w.gtinInput}
                setGtinInput={w.setGtinInput}
                onResolveGtin={w.resolveGtin}
                onSelectCatalogModel={w.selectCatalogModel}
                onStartManual={w.startManualRegistration}
                onClearLinkedModel={w.clearLinkedModel}
                onContinue={w.saveIdentity}
                notInCatalogOpen={w.notInCatalogOpen}
                notInCatalogGtin={w.notInCatalogGtin}
                onDismissNotInCatalog={w.dismissNotInCatalog}
              />
            ) : null}

            {w.step === 2 ? <CharacteristicsStep w={w} /> : null}

            {w.step === 3 ? (
              <DutiesStep
                duties={w.duties}
                decisionProtocol={w.decisionProtocol}
                catalogLinkMode={w.catalogLinkMode}
                busy={w.busy}
                onBack={() => w.setStep(w.catalogLinkMode || w.characteristicsSkipped ? 1 : 2)}
                onContinue={() => void w.continueFromDuties()}
              />
            ) : null}

            {w.step === 4 && !w.catalogLinkMode ? (
              <PrerequisitesStep
                prerequisites={w.prerequisites}
                checks={w.checks}
                setChecks={w.setChecks}
                openMandatory={w.openMandatory}
                busy={w.busy}
                onBack={() => w.setStep(3)}
                onRelease={w.release}
                onUploadEvidence={w.uploadEvidence}
                onExternalRef={w.setExternalEvidence}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
