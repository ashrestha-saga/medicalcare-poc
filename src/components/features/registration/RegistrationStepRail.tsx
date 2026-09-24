"use client";

import { useTranslations } from "next-intl";
import { REGISTRATION_STEPS } from "@/interfaces";

const STEP_KEYS = ["stepDevice", "stepCharacteristics", "stepDuties", "stepPrerequisites"] as const;

export function RegistrationStepRail({
  step,
  maxStep,
  onSelect,
}: {
  step: number;
  maxStep: number;
  onSelect: (n: number) => void;
}) {
  const t = useTranslations("registration");

  return (
    <nav className="p-reg__rail" data-testid="registration-step-rail" aria-label={t("stepsAria")}>
      {REGISTRATION_STEPS.map((keyLabel, i) => {
        const n = i + 1;
        const active = step === n;
        const label = t(STEP_KEYS[i]!);
        return (
          <button
            key={keyLabel}
            type="button"
            className="p-reg__step"
            data-active={active ? "1" : "0"}
            onClick={() => onSelect(n)}
            disabled={n > maxStep}
            aria-current={active ? "step" : undefined}
          >
            <span className="p-reg__step-num">{n}</span>
            <span className="p-reg__step-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
