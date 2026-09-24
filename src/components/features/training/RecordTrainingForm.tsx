"use client";

import type { TrainingFormOptionsDTO } from "@/interfaces";
import { useRecordTrainingForm } from "@/components/hooks/training/useRecordTrainingForm";
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
        ← To the overview
      </button>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Record training</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          One session, any number of participants — and each gets their own record.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em] text-muted-foreground">
              Session
            </CardTitle>
          </CardHeader>
          <CardContent className="p-train__form-body !pt-0">
            <label className="p-train__fld">
              <span>Type of training</span>
              <select
                value={trainingTypeCode}
                onChange={(e) => onTypeChange(e.target.value)}
                data-testid="training-type"
              >
                {form.types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label} — {t.legalBasis}
                  </option>
                ))}
              </select>
              {selectedType?.note ? <em className="p-train__fld-hint">{selectedType.note}</em> : null}
            </label>

            {subjectKind === "model" ? (
              <label className="p-train__fld">
                <span>Device model</span>
                <select
                  value={subjectModelId}
                  onChange={(e) => setSubjectModelId(e.target.value)}
                  data-testid="training-subject-model"
                >
                  {form.models.length === 0 ? (
                    <option value="">No inventory models</option>
                  ) : (
                    form.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : (
              <label className="p-train__fld">
                <span>Activity</span>
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
                <span>Date</span>
                <Input
                  type="date"
                  value={heldOn}
                  onChange={(e) => setHeldOn(e.target.value)}
                  data-testid="training-held-on"
                />
              </label>
              <label className="p-train__fld">
                <span>Location</span>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="training-location"
                />
              </label>
            </div>

            <div className="p-train__fld-row">
              <label className="p-train__fld">
                <span>Instructor</span>
                <Input
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  data-testid="training-instructor"
                />
              </label>
              <label className="p-train__fld">
                <span>Instructor qualification</span>
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
              <span>External instructor</span>
            </label>

            <label className="p-train__fld">
              <span>Basis of the training</span>
              <Input
                value={basisDocument}
                onChange={(e) => setBasisDocument(e.target.value)}
                data-testid="training-basis"
              />
              <em className="p-train__fld-hint">
                For instruction under § 11 this is the instructions for use. Without a named basis it
                is not clear what was trained on.
              </em>
            </label>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.08em] text-muted-foreground">
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="p-train__form-body !pt-0">
            <div className="p-train__mode-pick" role="group" aria-label="Session mode">
              <button
                type="button"
                className={cn("p-train__mode-btn", mode === "individual" && "is-on")}
                aria-pressed={mode === "individual"}
                onClick={() => setModeSafe("individual")}
                data-testid="training-mode-individual"
              >
                <span className="p-train__mode-dot" aria-hidden />
                <span>
                  <b>Individual training</b>
                  <em>One person, one record.</em>
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
                  <b>Group training</b>
                  <em>One session, one record per participant.</em>
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
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void submit()}
                disabled={saving}
                data-testid="training-save"
              >
                {saving ? "Saving…" : "Create records"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
