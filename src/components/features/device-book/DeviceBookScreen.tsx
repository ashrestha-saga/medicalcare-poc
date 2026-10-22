"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { useDeviceBookComposed } from "@/components/hooks/device-book/useDeviceBookComposed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComposedBookEvidenceDTO } from "@/interfaces";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  return `${d}.${m}.${y}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = formatDate(iso);
  if (iso.length < 16) return date;
  return `${date} ${iso.slice(11, 16)}`;
}

function placeLine(parts: {
  siteName?: string | null;
  areaName?: string | null;
  room?: string | null;
}): string {
  return [parts.siteName, parts.areaName, parts.room].filter(Boolean).join(" · ") || "—";
}

function Section({
  legal,
  title,
  children,
}: {
  legal: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {legal}
      </p>
      <h3 className="mt-1 text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm italic text-muted-foreground">{text}</p>;
}

function IfuChip({ hasIfu, present, missing }: { hasIfu: boolean; present: string; missing: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
        hasIfu
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
      )}
    >
      {hasIfu ? present : missing}
    </span>
  );
}

export function DeviceBookScreen() {
  const t = useTranslations("pages.deviceBook");
  const list = useDeviceBookComposed();
  const fileRef = useRef<HTMLInputElement>(null);
  const [externalRef, setExternalRef] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="device-book-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("denied")}>
            <p className="text-sm text-muted-foreground">{t("denied")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const book = list.book;
  const detailOpen = Boolean(list.deviceId);

  const onPickFile = async (file: File | null) => {
    if (!file || !list.deviceId || !list.canUploadIfu) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      await list.uploadIfu({ deviceInstanceId: list.deviceId, dataUrl });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSaveExternal = async () => {
    if (!list.deviceId || !externalRef.trim() || !list.canUploadIfu) return;
    setUploading(true);
    try {
      const ok = await list.uploadIfu({
        deviceInstanceId: list.deviceId,
        externalRecordRef: externalRef.trim(),
      });
      if (ok) setExternalRef("");
    } finally {
      setUploading(false);
    }
  };

  const openEvidence = (ev: ComposedBookEvidenceDTO) => {
    if (ev.attachmentBlobId) {
      window.open(`/api/attachments/${ev.attachmentBlobId}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (ev.externalRecordRef) {
      const ref = ev.externalRecordRef.trim();
      if (/^https?:\/\//i.test(ref)) {
        window.open(ref, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="p-work" data-testid="device-book-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          {!detailOpen ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full max-w-xl space-y-1">
                  <Label htmlFor="device-book-search" className="text-[11px] uppercase tracking-wide">
                    {t("search.label")}
                  </Label>
                  <Input
                    id="device-book-search"
                    value={list.search}
                    onChange={(e) => list.setSearch(e.target.value)}
                    placeholder={t("search.placeholder")}
                    data-testid="device-book-search"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("count", {
                    shown: list.filteredDevices.length,
                    total: list.devices.length,
                  })}
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">{t("col.inventory")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("col.name")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("col.serial")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("col.place")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("col.ifu")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.listLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                          {t("loading")}
                        </td>
                      </tr>
                    ) : list.filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                          {list.devices.length === 0 ? t("empty") : t("search.noMatch")}
                        </td>
                      </tr>
                    ) : (
                      list.filteredDevices.map((d) => (
                        <tr
                          key={d.id}
                          className="cursor-pointer border-t hover:bg-muted/40"
                          data-testid={`device-book-row-${d.inventoryNumber}`}
                          onClick={() => list.setDevice(d.id)}
                        >
                          <td className="px-3 py-3 align-top font-mono text-xs font-medium">
                            {d.inventoryNumber}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <p className="font-medium">{d.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[d.manufacturer, d.basicUdiDi || d.udiDi]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </td>
                          <td className="px-3 py-3 align-top font-mono text-xs">
                            {d.serialNumber ?? "—"}
                          </td>
                          <td className="px-3 py-3 align-top text-muted-foreground">
                            {placeLine(d)}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <IfuChip
                              hasIfu={d.hasIfu}
                              present={t("ifu.present")}
                              missing={t("ifu.missing")}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => list.setDevice(null)}
                  data-testid="device-book-back"
                >
                  {t("actions.back")}
                </Button>
              </div>

              {list.bookLoading && !book ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : !book ? (
                <p className="text-sm text-muted-foreground">{t("notFound")}</p>
              ) : (
                <div className="space-y-4">
                  <header className="rounded-lg border bg-background p-4">
                    <p className="font-mono text-xs text-muted-foreground">
                      {book.device.inventoryNumber}
                      {book.device.serialNumber ? ` · SN ${book.device.serialNumber}` : ""}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{book.device.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[book.device.manufacturer, book.device.modelName || book.device.tradeName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {placeLine(book.device)}
                      {book.device.basicUdiDi || book.device.udiDi
                        ? ` · UDI ${book.device.basicUdiDi || book.device.udiDi}`
                        : ""}
                    </p>
                  </header>

                  <Section legal="§ 4 · § 13 Abs. 2" title={t("sections.documents")}>
                    {!book.modelIfu && book.evidence.length === 0 ? (
                      <Empty text={t("ifu.empty")} />
                    ) : (
                      <ul className="space-y-2">
                        {book.modelIfu ? (
                          <li
                            key={book.modelIfu.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                            data-testid="device-book-model-ifu"
                          >
                            <div>
                              <p className="font-medium">
                                {t("ifu.label")} · {book.modelIfu.revisionLabel}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Model · {book.modelIfu.language} · {book.modelIfu.recordedByName},{" "}
                                {formatDateTime(book.modelIfu.recordedAt)}
                              </p>
                            </div>
                            {book.modelIfu.openUrl ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(book.modelIfu!.openUrl!, "_blank")}
                                data-testid="device-book-open-model-ifu"
                              >
                                {t("actions.openIfu")}
                              </Button>
                            ) : null}
                          </li>
                        ) : null}
                        {book.evidence.map((ev) => (
                          <li
                            key={ev.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium">{t("ifu.label")}</p>
                              <p className="text-xs text-muted-foreground">
                                {ev.recordedBy}, {formatDateTime(ev.recordedAt)}
                                {ev.externalRecordRef
                                  ? ` · ${ev.externalRecordRef}`
                                  : ev.contentType
                                    ? ` · ${ev.contentType}`
                                    : ""}
                              </p>
                            </div>
                            {(ev.attachmentBlobId || ev.externalRecordRef) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEvidence(ev)}
                                data-testid={`device-book-open-ifu-${ev.id}`}
                              >
                                {t("actions.openIfu")}
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {list.canUploadIfu ? (
                      <div className="mt-4 space-y-3 rounded-md border border-dashed p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("ifu.uploadTitle")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,application/pdf,image/*"
                            className="hidden"
                            data-testid="device-book-ifu-file"
                            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={uploading}
                            onClick={() => fileRef.current?.click()}
                            data-testid="device-book-ifu-upload"
                          >
                            {t("actions.uploadFile")}
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="flex-1 space-y-1">
                            <Label htmlFor="ifu-ref" className="text-[11px] uppercase tracking-wide">
                              {t("ifu.externalRef")}
                            </Label>
                            <Input
                              id="ifu-ref"
                              value={externalRef}
                              onChange={(e) => setExternalRef(e.target.value)}
                              placeholder={t("ifu.externalPlaceholder")}
                              data-testid="device-book-ifu-ref"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={uploading || !externalRef.trim()}
                            onClick={() => void onSaveExternal()}
                            data-testid="device-book-ifu-ref-save"
                          >
                            {t("actions.saveRef")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Section>

                  <Section legal="§ 13 Absatz 2 Nummer 1" title={t("sections.identity")}>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("col.inventory")}</dt>
                        <dd className="font-mono">{book.device.inventoryNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("col.serial")}</dt>
                        <dd className="font-mono">{book.device.serialNumber ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("col.place")}</dt>
                        <dd>{placeLine(book.device)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{t("ifu.label")}</dt>
                        <dd>
                          <IfuChip
                            hasIfu={book.evidence.length > 0}
                            present={t("ifu.present")}
                            missing={t("ifu.missing")}
                          />
                        </dd>
                      </div>
                    </dl>
                  </Section>

                  <Section legal="§ 13 Absatz 2 Nummern 3 und 4" title={t("sections.inspections")}>
                    {book.duties.length === 0 ? (
                      <Empty text={t("emptyDuties")} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                              <th className="py-1 pr-3 font-medium">{t("duty.duty")}</th>
                              <th className="py-1 pr-3 font-medium">{t("duty.basis")}</th>
                              <th className="py-1 pr-3 font-medium">{t("duty.last")}</th>
                              <th className="py-1 font-medium">{t("duty.next")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {book.duties.map((d) => (
                              <tr key={`${d.dutyKey}-${d.dueAt}`} className="border-b border-border/50">
                                <td className="py-2 pr-3 font-medium">{d.title}</td>
                                <td className="py-2 pr-3 text-xs text-muted-foreground">
                                  {d.basisText}
                                </td>
                                <td className="py-2 pr-3 font-mono text-xs">
                                  {formatDate(d.lastCompletedAt)}
                                  {d.lastPerformedBy ? ` · ${d.lastPerformedBy}` : ""}
                                </td>
                                <td className="py-2 font-mono text-xs">{formatDate(d.dueAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>

                  <Section
                    legal="§ 13 Absatz 2 Nummer 2 · § 4 Absatz 3"
                    title={t("sections.instruction")}
                  >
                    {book.trainings.length === 0 ? (
                      <Empty text={t("emptyTrainings")} />
                    ) : (
                      <ul className="space-y-2">
                        {book.trainings.map((tr, i) => (
                          <li key={`${tr.heldOn}-${i}`} className="text-sm">
                            <span className="font-medium">{formatDate(tr.heldOn)}</span> ·{" "}
                            {tr.trainingType}
                            <span className="block text-xs text-muted-foreground">
                              {tr.participants.join(", ") || "—"} · {t("instructor")}{" "}
                              {tr.instructorName}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section legal="§ 13 Absatz 2 Nummer 5" title={t("sections.malfunctions")}>
                    {book.entries.length === 0 ? (
                      <Empty text={t("emptyEntries")} />
                    ) : (
                      <ul className="space-y-3">
                        {book.entries.map((e) => (
                          <li key={e.id} className="text-sm">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.kind}</span>{" "}
                            <span className="font-medium">{formatDate(e.occurredAt)}</span>
                            {e.repeatCount != null ? (
                              <span className="ml-1 text-xs text-destructive">{e.repeatCount}×</span>
                            ) : null}
                            <p className="mt-1">{e.description}</p>
                            {e.consequence ? (
                              <p className="text-xs text-muted-foreground">
                                {t("consequence")}: {e.consequence}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section legal="§ 13 Absatz 2 · MPAMIV" title={t("sections.incidents")}>
                    {book.incidents.length === 0 ? (
                      <Empty text={t("emptyIncidents")} />
                    ) : (
                      <ul className="space-y-2">
                        {book.incidents.map((inc) => {
                          const label =
                            inc.suspectedSerious === null
                              ? t("incident.unassessed")
                              : inc.suspectedSerious
                                ? inc.reportedAt
                                  ? t("incident.reported")
                                  : t("incident.unreported")
                                : t("incident.notSerious");
                          return (
                            <li key={inc.id} className="text-sm">
                              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{label}</span>{" "}
                              <span className="font-medium">{formatDate(inc.occurredAt)}</span>
                              <p className="mt-1">{inc.description}</p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Section>
                </div>
              )}
            </>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
