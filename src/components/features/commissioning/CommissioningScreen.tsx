"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SetupStepDTO } from "@/interfaces/setup";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { PageLoading } from "@/components/features/shared/PageLoading";
import { useCommissioningProgress } from "@/components/hooks/commissioning/useCommissioningProgress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function StepCard({ step, index }: { step: SetupStepDTO; index: number }) {
  const t = useTranslations("commissioning");
  const title = t(`steps.${step.titleKey}` as "steps.sites");
  const why = t(`why.${step.whyKey}` as "why.sitesOk", step.whyParams ?? {});

  return (
    <div
      className="p-setup-step border-border bg-card"
      data-s={step.status}
      data-testid={`commissioning-step-${step.id}`}
    >
      <span className="p-setup-step__n" aria-hidden>
        {step.status === "ok" ? "✓" : index + 1}
      </span>
      <div className="min-w-0">
        <b className="p-setup-step__title text-foreground">{title}</b>
        <p className="p-setup-step__why text-muted-foreground">{why}</p>
        {step.status === "open" ? (
          <div className="mt-2">
            <Button asChild size="sm" variant="outline" data-testid={`commissioning-go-${step.id}`}>
              <Link href={step.href}>{t("goThere")}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Mandanten-Inbetriebnahme — ten computed criteria (backoffice v26). */
export function CommissioningScreen() {
  const t = useTranslations("commissioning");
  const tCommon = useTranslations("common");
  const { canView, progress, error, loading, dismissBusy, dismiss } =
    useCommissioningProgress();

  if (!canView) {
    return (
      <AccessDenied
        title={t("title", { done: 0, total: 10 })}
        description={tCommon("denied")}
        hint={tCommon("contactAdmin")}
        testId="commissioning-denied"
      />
    );
  }

  if (loading) {
    return (
      <div className="p-work" data-testid="commissioning-loading">
        <main className="p-main">
          <ListPageShell title={t("title", { done: 0, total: 10 })}>
            <PageLoading />
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="p-work" data-testid="commissioning-error">
        <main className="p-main">
          <ListPageShell title={t("title", { done: 0, total: 10 })}>
            <Alert variant="destructive">
              <AlertDescription>{error ?? tCommon("loading")}</AlertDescription>
            </Alert>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="commissioning-page">
      <main className="p-main">
        <ListPageShell
          title={t("title", { done: progress.done, total: progress.total })}
          testId="commissioning-screen"
          variant="board"
          contentClassName="p-setup"
        >
          <div className="p-setup__grid">
            {progress.steps.map((step, i) => (
              <StepCard key={step.id} step={step} index={i} />
            ))}
          </div>

          {progress.complete ? (
            <div
              className={cn(
                "mt-4 rounded-lg border border-border p-4",
                "bg-muted/40 text-foreground",
              )}
              data-testid="commissioning-complete"
            >
              <p className="text-base font-semibold">{t("allDone")}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{t("allDoneHint")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!progress.dismissed ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={dismissBusy}
                    onClick={() => void dismiss()}
                    data-testid="commissioning-dismiss"
                  >
                    {dismissBusy ? tCommon("loading") : t("dismiss")}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("dismissedHint")}</p>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href="/management">{t("openManagement")}</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
