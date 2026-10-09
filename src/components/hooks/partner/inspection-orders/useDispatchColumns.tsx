"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestRowDTO, DispositionDisplayState } from "@/interfaces/console";
import type { DispatchAssignee } from "@/components/hooks/partner/inspection-orders/useInspectionOrdersList";
import { Badge } from "@/components/ui/badge";
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

export interface DispatchColumnActions {
  canDispatch: boolean;
  busyRef: string | null;
  appointmentValue: (row: ConsoleRequestRowDTO) => string;
  onDraftDate: (reference: string, value: string) => void;
  onAdvance: (row: ConsoleRequestRowDTO) => void;
  onAssignHandler: (row: ConsoleRequestRowDTO, userId: string | null) => void;
  ensureAssignees: (tenantId: string) => void;
  assigneesByTenant: Record<string, DispatchAssignee[]>;
  assigneesLoading: string | null;
}

export function useDispatchColumns(
  actions: DispatchColumnActions,
): ColumnDef<ConsoleRequestRowDTO>[] {
  const t = useTranslations("console");
  const {
    canDispatch,
    busyRef,
    appointmentValue,
    onDraftDate,
    onAdvance,
    onAssignHandler,
    ensureAssignees,
    assigneesByTenant,
    assigneesLoading,
  } = actions;

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
              <Badge variant="outline" className="mt-1 text-[10px] uppercase tracking-wide">
                {t("managedChipNo")}
              </Badge>
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
        id: "handler",
        accessorFn: (row) => row.assigneeName ?? "",
        header: ({ column }) => <SortHeader label={t("colHandler")} column={column} />,
        cell: ({ row }) => {
          const r = row.original;
          const done =
            r.displayState === "abgeschlossen" || r.displayState === "abgelehnt";
          if (!canDispatch || done) {
            return <span className="text-foreground">{r.assigneeName ?? "—"}</span>;
          }
          const options = assigneesByTenant[r.tenantId] ?? [];
          const loading = assigneesLoading === r.tenantId;
          return (
            <select
              className="h-8 max-w-[200px] rounded-md border border-border bg-transparent px-2 text-xs"
              value={r.assigneeUserId ?? ""}
              disabled={busyRef === r.reference || loading}
              data-testid={`dispatch-handler-${r.reference}`}
              onFocus={() => void ensureAssignees(r.tenantId)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onAssignHandler(r, e.target.value || null)}
            >
              <option value="">{t("sitePortalUnassigned")}</option>
              {r.assigneeUserId &&
              !options.some((a) => a.userId === r.assigneeUserId) ? (
                <option value={r.assigneeUserId}>{r.assigneeName ?? r.assigneeUserId}</option>
              ) : null}
              {options.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name}
                  {a.isExternal ? " *" : ""}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        id: "appointment",
        accessorFn: (row) => appointmentValue(row),
        header: ({ column }) => <SortHeader label={t("colAppointment")} column={column} />,
        cell: ({ row }) => {
          const r = row.original;
          const done =
            r.displayState === "abgeschlossen" || r.displayState === "abgelehnt";
          if (canDispatch && !done) {
            return (
              <Input
                type="datetime-local"
                className="h-8 w-[190px]"
                value={appointmentValue(r)}
                disabled={busyRef === r.reference}
                onChange={(e) => onDraftDate(r.reference, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                data-testid={`dispatch-appointment-${r.reference}`}
              />
            );
          }
          return (
            <span className="whitespace-nowrap text-xs">
              {r.scheduledAt
                ? new Date(r.scheduledAt).toLocaleString(undefined, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          );
        },
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
              {canDispatch && r.nextDisplayState ? (
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
    [
      t,
      canDispatch,
      busyRef,
      appointmentValue,
      onDraftDate,
      onAdvance,
      onAssignHandler,
      ensureAssignees,
      assigneesByTenant,
      assigneesLoading,
    ],
  );
}
