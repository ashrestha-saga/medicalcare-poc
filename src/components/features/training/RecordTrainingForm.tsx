"use client";

import { useTranslations } from "next-intl";
import type { TrainingFormOptionsDTO } from "@/interfaces";
import { useRecordTrainingForm } from "@/components/hooks/training/useRecordTrainingForm";
import { TrainingModelSearchSelect } from "@/components/features/training/TrainingModelSearchSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function RecordTrainingForm({
  form,
  onCancel,
  onCreated,
}: {
  form: TrainingFormOptionsDTO;
  onCancel: () => void;
  onCreated: (eventId: string) => void;
}) {
  const t = useTranslations("trainingDetail");
  const tCommon = useTranslations("common");
  const {
    selectedType,
    subjectKind,
    trainingTypeCode,
    onTypeChange,
    subjectModelId,
    setSubjectModelId,
    subjectActivity,
    setSubjectActivity,
    heldOn,
    setHeldOn,
    location,
    setLocation,
    instructorName,
    setInstructorName,
    instructorQualification,
    setInstructorQualification,
    instructorExternal,
    setInstructorExternal,
    basisDocument,
    setBasisDocument,
    mode,
    setModeSafe,
    personIds,
    togglePerson,
    saving,
    error,
    submit,
    recordHint,
  } = useRecordTrainingForm({ form, onCreated });

  return (
    <div className="px-4 pb-6 pt-4 sm:px-[18px]" data-testid="training-record-form">
      <button
        type="button"
        className="mb-3 text-sm font-semibold text-primary hover:underline"
        onClick={onCancel}
        data-testid="training-back-overview"
      >
        {t("backToOverview")}
      </button>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t("recordTitle")}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("recordLead")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em] text-muted-foreground">
              {t("session")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-train__form-body !pt-0">
            <label className="p-train__fld">
              <span>{t("typeOfTraining")}</span>
              <select
                value={trainingTypeCode}
                onChange={(e) => onTypeChange(e.target.value)}
                data-testid="training-type"
              >
                {form.types.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.label} {tCommon("dash")} {type.legalBasis}
                  </option>
                ))}
              </select>
              {selectedType?.note ? <em className="p-train__fld-hint">{selectedType.note}</em> : null}
            </label>

            {subjectKind === "model" ? (
              <label className="p-train__fld">
                <span>{t("deviceModel")}</span>
                <TrainingModelSearchSelect
                  models={form.models}
                  value={subjectModelId}
                  onChange={setSubjectModelId}
                />
              </label>
            ) : (
              <label className="p-train__fld">
                <span>{t("activity")}</span>
                <select
                  value={subjectActivity}
                  onChange={(e) => setSubjectActivity(e.target.value)}
                  data-testid="training-subject-activity"
                >
                  {form.activities.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="p-train__fld-row">
              <label className="p-train__fld">
                <span>{t("date")}</span>
                <Input
                  type="date"
                  value={heldOn}
                  onChange={(e) => setHeldOn(e.target.value)}
                  data-testid="training-held-on"
                />
              </label>
              <label className="p-train__fld">
                <span>{t("location")}</span>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="training-location"
                />
              </label>
            </div>

            <div className="p-train__fld-row">
              <label className="p-train__fld">
                <span>{t("instructor")}</span>
                <Input
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  data-testid="training-instructor"
                />
              </label>
              <label className="p-train__fld">
                <span>{t("instructorQualification")}</span>
                <Input
                  value={instructorQualification}
                  onChange={(e) => setInstructorQualification(e.target.value)}
                  data-testid="training-instructor-qual"
                />
              </label>
            </div>

            <label className="p-train__check">
              <input
                type="checkbox"
                checked={instructorExternal}
                onChange={(e) => setInstructorExternal(e.target.checked)}
                data-testid="training-instructor-external"
              />
              <span>{t("externalInstructor")}</span>
            </label>

            <label className="p-train__fld">
              <span>{t("basisOfTraining")}</span>
              <Input
                value={basisDocument}
                onChange={(e) => setBasisDocument(e.target.value)}
                data-testid="training-basis"
              />
              <em className="p-train__fld-hint">
                {t("basisHint")}
              </em>
            </label>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em] text-muted-foreground">
              {t("participants")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-train__form-body !pt-0">
            <div className="p-train__mode-pick" role="group" aria-label={t("sessionModeAria")}>
              <button
                type="button"
                className={cn("p-train__mode-btn", mode === "individual" && "is-on")}
                aria-pressed={mode === "individual"}
                onClick={() => setModeSafe("individual")}
                data-testid="training-mode-individual"
              >
                <span className="p-train__mode-dot" aria-hidden />
                <span>
                  <b>{t("individualTraining")}</b>
                  <em>{t("individualTrainingHint")}</em>
                </span>
              </button>
              <button
                type="button"
                className={cn("p-train__mode-btn", mode === "group" && "is-on")}
                aria-pressed={mode === "group"}
                onClick={() => setModeSafe("group")}
                data-testid="training-mode-group"
              >
                <span className="p-train__mode-dot" aria-hidden />
                <span>
                  <b>{t("groupTraining")}</b>
                  <em>{t("groupTrainingHint")}</em>
                </span>
              </button>
            </div>

            <ul className="p-train__pick-list">
              {form.staff.map((p) => {
                const on = personIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="p-train__pick">
                      <input
                        type={mode === "individual" ? "radio" : "checkbox"}
                        name="training-participant"
                        checked={on}
                        onChange={() => togglePerson(p.id)}
                        data-testid={`training-person-${p.id}`}
                      />
                      <span>
                        <b>{p.name}</b>
                        {p.jobTitle ? <em>{p.jobTitle}</em> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <p className="p-train__fld-hint">{recordHint}</p>

            {error ? (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="p-train__form-actions">
              <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void submit()}
                disabled={saving}
                data-testid="training-save"
              >
                {saving ? t("saving") : t("createRecords")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
