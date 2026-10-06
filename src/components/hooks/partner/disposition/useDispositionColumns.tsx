"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestRowDTO, DispositionDisplayState } from "@/interfaces/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function SortHeader({
  label,
  column,
}: {
  label: string;
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
}) {
  return (
    <Button
      type="button"
      variant="tableHeader"
      className="-ml-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
    </Button>
  );
}

function stateChipClass(state: DispositionDisplayState): string {
  if (state === "erfasst") return "bg-amber-50 text-amber-900 border-amber-200";
  if (state === "abgeschlossen") return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (state === "abgelehnt") return "bg-rose-50 text-rose-900 border-rose-200";
  return "bg-muted text-muted-foreground border-border";
}

export interface DispositionColumnActions {
  canAdvance: boolean;
  busyRef: string | null;
  appointmentValue: (row: ConsoleRequestRowDTO) => string;
  onDraftDate: (reference: string, value: string) => void;
  onAdvance: (row: ConsoleRequestRowDTO) => void;
}

export function useDispositionColumns(
  actions: DispositionColumnActions,
): ColumnDef<ConsoleRequestRowDTO>[] {
  const t = useTranslations("console");
  const { canAdvance, busyRef, appointmentValue, onDraftDate, onAdvance } = actions;

  return useMemo(
    () => [
      {
        accessorKey: "reference",
        id: "assignment",
        header: ({ column }) => <SortHeader label={t("colAssignment")} column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.reference}</span>
        ),
      },
      {
        accessorKey: "tenantName",
        id: "institution",
        header: ({ column }) => <SortHeader label={t("colInstitution")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-foreground">{row.original.tenantName}</p>
            {!row.original.managed ? (
              <span className="mt-1 inline-block rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("managedChipNo")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "deviceLabel",
        id: "device",
        header: ({ column }) => <SortHeader label={t("colDevice")} column={column} />,
        cell: ({ row }) => (
          <div>
            <div>{row.original.deviceLabel}</div>
            {row.original.deviceDetail ? (
              <div className="text-xs text-muted-foreground">{row.original.deviceDetail}</div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "serviceType",
        id: "service",
        header: ({ column }) => <SortHeader label={t("colService")} column={column} />,
        cell: ({ row }) => (
          <span className="text-xs lowercase">{row.original.serviceType}</span>
        ),
      },
      {
        id: "contractor",
        accessorFn: (row) => row.executorCode ?? row.executorName ?? "",
        header: ({ column }) => <SortHeader label={t("colContractor")} column={column} />,
        cell: ({ row }) => (
          <abbr title={row.original.executorName ?? undefined} className="no-underline">
            {row.original.executorCode ?? row.original.executorName ?? "—"}
          </abbr>
        ),
      },
      {
        accessorKey: "assigneeName",
        id: "handler",
        header: ({ column }) => <SortHeader label={t("colHandler")} column={column} />,
        cell: ({ row }) => (
          <span className="text-foreground">{row.original.assigneeName ?? "—"}</span>
        ),
      },
      {
        id: "appointment",
        accessorFn: (row) => appointmentValue(row),
        header: ({ column }) => <SortHeader label={t("colAppointment")} column={column} />,
        cell: ({ row }) =>
          canAdvance ? (
            <Input
              type="date"
              className="h-8 w-[140px]"
              value={appointmentValue(row.original)}
              disabled={busyRef === row.original.reference}
              onChange={(e) => onDraftDate(row.original.reference, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span>{row.original.scheduledAt ?? "—"}</span>
          ),
      },
      {
        accessorKey: "displayState",
        id: "state",
        header: ({ column }) => <SortHeader label={t("colState")} column={column} />,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col items-start gap-1.5">
              <span
                className={cn(
                  "inline-block rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  stateChipClass(r.displayState),
                )}
              >
                {t(`displayState_${r.displayState}` as "displayState_erfasst")}
              </span>
              {canAdvance && r.nextDisplayState ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={busyRef === r.reference}
                  data-testid={`disposition-advance-${r.reference}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdvance(r);
                  }}
                >
                  → {t(`displayState_${r.nextDisplayState}` as "displayState_erfasst")}
                </Button>
              ) : null}
              {r.displayState === "in_arbeit" ? (
                <span className="text-[10px] text-muted-foreground">
                  {t("dispositionCompleteElsewhere")}
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, canAdvance, busyRef, appointmentValue, onDraftDate, onAdvance],
  );
}
