"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TrainingEventDTO } from "@/interfaces";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { Button } from "@/components/ui/button";
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

function eventSubjectTitle(event: TrainingEventDTO): string {
  return event.subjectModelName || event.subjectActivity || event.trainingTypeLabel;
}

export function useTrainingColumns(onOpen: (id: string) => void): ColumnDef<TrainingEventDTO>[] {
  const t = useTranslations("table.training");
  const tTable = useTranslations("table");

  return useMemo(
    () => [
      {
        id: "subject",
        accessorFn: (row) => eventSubjectTitle(row),
        header: ({ column }) => <SortHeader label={t("subject")} column={column} />,
        cell: ({ row }) => {
          const event = row.original;
          const sub = [event.location, event.basisDocument].filter(Boolean).join(" · ");
          return (
            <div>
              <p className="font-medium text-foreground">{eventSubjectTitle(event)}</p>
              {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
            </div>
          );
        },
      },
      {
        accessorKey: "trainingTypeLabel",
        id: "type",
        header: ({ column }) => <SortHeader label={t("type")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="text-foreground">{row.original.trainingTypeLabel}</p>
            <p className="text-xs text-muted-foreground">{row.original.legalBasis}</p>
          </div>
        ),
      },
      {
        accessorKey: "heldOn",
        id: "date",
        header: ({ column }) => <SortHeader label={t("date")} column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
            {row.original.heldOn}
          </span>
        ),
      },
      {
        accessorKey: "instructorName",
        id: "instructor",
        header: ({ column }) => <SortHeader label={t("instructor")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="text-foreground">{row.original.instructorName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.instructorQualification}
              {row.original.instructorExternal ? " · external" : ""}
            </p>
          </div>
        ),
      },
      {
        id: "participants",
        accessorFn: (row) => row.recordCount,
        header: ({ column }) => <SortHeader label={t("participants")} column={column} />,
        cell: ({ row }) => {
          const group = row.original.mode === "group";
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "inline-block rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.09em]",
                  group
                    ? "bg-[var(--chip-stk-bg,#e2eefb)] text-[var(--chip-stk-fg,#14539b)] dark:bg-primary/20 dark:text-primary"
                    : "bg-[var(--chip-mtk-bg,#dff3e8)] text-[var(--chip-mtk-fg,#146044)] dark:bg-emerald-500/15 dark:text-emerald-400",
                )}
              >
                {group ? "Group" : "Individual"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{row.original.recordCount}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "statusLabel",
        id: "status",
        header: ({ column }) => <SortHeader label={t("status")} column={column} />,
        cell: ({ row }) => {
          const kind = row.original.statusKind;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.09em]",
                kind === "overdue" && "text-[var(--warn)]",
                (kind === "valid" || kind === "no_expiry") && "text-[var(--green)]",
                kind !== "overdue" && kind !== "valid" && kind !== "no_expiry" && "text-muted-foreground",
              )}
            >
              <i
                aria-hidden
                className={cn(
                  "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                  kind === "overdue" && "bg-[var(--warn)]",
                  (kind === "valid" || kind === "no_expiry") && "bg-[var(--green)]",
                  kind !== "overdue" && kind !== "valid" && kind !== "no_expiry" && "bg-muted-foreground",
                )}
              />
              {row.original.statusLabel}
            </span>
          );
        },
      },
      {
        id: "open",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{tTable("open")}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <OpenButton
            onClick={() => onOpen(row.original.id)}
            data-testid={`training-open-${row.original.id}`}
          />
        ),
      },
    ],
    [onOpen, t, tTable],
  );
}
