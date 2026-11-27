"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DeviceDutyDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/Field";
import {
  useExternalPerformance,
  type ExternalPerformanceForm,
} from "@/components/hooks/devices/useExternalPerformance";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): ExternalPerformanceForm => ({
  performedAt: today(),
  performedBy: "",
  result: "passed",
  note: "",
  file: null,
});

/** E108 — "Upload report" dialog on a duty row: external firm, date, result, optional file. */
export function ExternalPerformanceDialog({
  duty,
  onClose,
  onRecorded,
}: {
  duty: DeviceDutyDTO | null;
  onClose: () => void;
  onRecorded?: () => void;
}) {
  const t = useTranslations("inventoryDetail");
  const [form, setForm] = useState<ExternalPerformanceForm>(emptyForm);
  const { busy, submit } = useExternalPerformance(onRecorded);

  const noteRequired = form.result === "failed";
  const valid =
    Boolean(form.performedAt) &&
    Boolean(form.performedBy.trim()) &&
    (!noteRequired || Boolean(form.note.trim()));

  const close = () => {
    setForm(emptyForm());
    onClose();
  };

  return (
    <Dialog open={duty != null} onOpenChange={(open) => !open && close()}>
      <DialogContent data-testid="external-performance-dialog">
        <DialogHeader>
          <DialogTitle>{t("externalUploadTitle")}</DialogTitle>
          <DialogDescription>
            {duty?.title}
            {" — "}
            {t("externalUploadHint")}
          </DialogDescription>
        </DialogHeader>
        <Field label={t("externalFirm")} htmlFor="ext-firm" required>
          <input
            id="ext-firm"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.performedBy}
            onChange={(e) => setForm((f) => ({ ...f, performedBy: e.target.value }))}
          />
        </Field>
        <Field label={t("externalPerformedAt")} htmlFor="ext-date" required>
          <input
            id="ext-date"
            type="date"
            max={today()}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.performedAt}
            onChange={(e) => setForm((f) => ({ ...f, performedAt: e.target.value }))}
          />
        </Field>
        <Field label={t("markDoneResult")} htmlFor="ext-result" required>
          <select
            id="ext-result"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.result}
            onChange={(e) =>
              setForm((f) => ({ ...f, result: e.target.value as ExternalPerformanceForm["result"] }))
            }
          >
            <option value="passed">{t("markDoneResultPassed")}</option>
            <option value="passed_with_conditions">{t("markDoneResultConditions")}</option>
            <option value="failed">{t("markDoneResultFailed")}</option>
          </select>
        </Field>
        <Field label={t("externalNote")} htmlFor="ext-note" required={noteRequired}>
          <textarea
            id="ext-note"
            className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </Field>
        <Field label={t("externalFile")} htmlFor="ext-file" hint={t("externalFileHint")}>
          <input
            id="ext-file"
            type="file"
            accept="application/pdf,image/*"
            className="block w-full text-sm"
            onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("markDoneCancel")}
          </Button>
          <Button
            type="button"
            disabled={!valid || busy || !duty}
            onClick={async () => {
              if (!duty) return;
              if (await submit(duty.id, form)) close();
            }}
            data-testid="external-performance-save"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("externalSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
