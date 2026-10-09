"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestRowDTO, DispositionDisplayState } from "@/interfaces/console";
import { Badge } from "@/components/ui/badge";
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

/** Display-state chips aligned with clinic service-request badge colours. */
function displayStateBadge(state: DispositionDisplayState): {
  variant: "outline" | "secondary" | "default" | "warning" | "success" | "destructive";
  className?: string;
} {
  if (state === "erfasst") {
    return {
      variant: "outline",
      className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    };
  }
  if (state === "zugewiesen") {
    return {
      variant: "outline",
      className: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    };
  }
  if (state === "terminiert") {
    return {
      variant: "default",
      className: "border-transparent bg-primary/15 text-primary",
    };
  }
  if (state === "in_arbeit") {
    return { variant: "warning" };
  }
  if (state === "abgeschlossen") {
    return { variant: "success" };
  }
  if (state === "abgelehnt") {
    return { variant: "destructive" };
  }
  return { variant: "secondary" };
}

export interface DispositionColumnActions {
  canManage: boolean;
  busyRef: string | null;
  onAskTakeOver: (row: ConsoleRequestRowDTO) => void;
}

/** Customer portfolio columns — oversight; schedule only via Our dispatch. */
export function useDispositionColumns(
  actions: DispositionColumnActions,
): ColumnDef<ConsoleRequestRowDTO>[] {
  const t = useTranslations("console");
  const { canManage, busyRef, onAskTakeOver } = actions;

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
          <p className="font-semibold text-foreground">{row.original.tenantName}</p>
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
        cell: ({ row }) => {
          const r = row.original;
          const label = r.executorCode ?? r.executorName ?? "—";
          return (
            <Badge
              variant={r.isExecutor ? "success" : "secondary"}
              title={r.executorName ?? undefined}
              className={cn(
                "text-[10px] uppercase tracking-wide",
                !r.isExecutor && "border-border bg-muted text-muted-foreground",
              )}
            >
              {label}
            </Badge>
          );
        },
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
        accessorFn: (row) => row.scheduledAt ?? "",
        header: ({ column }) => <SortHeader label={t("colAppointment")} column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {row.original.scheduledAt
              ? new Date(row.original.scheduledAt).toLocaleString(undefined, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "displayState",
        id: "state",
        header: ({ column }) => <SortHeader label={t("colState")} column={column} />,
        cell: ({ row }) => {
          const r = row.original;
          const badge = displayStateBadge(r.displayState);
          return (
            <div className="flex flex-col items-start gap-1.5">
              <Badge
                variant={badge.variant}
                className={cn("text-[10px] uppercase tracking-wide", badge.className)}
              >
                {t(`displayState_${r.displayState}` as "displayState_erfasst")}
              </Badge>
              {canManage && !r.isExecutor ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  disabled={busyRef === r.reference}
                  data-testid={`disposition-takeover-${r.reference}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskTakeOver(r);
                  }}
                >
                  {t("dispositionTakeOver")}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, canManage, busyRef, onAskTakeOver],
  );
}
