"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DueDateRowDTO } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export interface DueDatesTableActions {
  canAssign: boolean;
  assigningId: string | null;
  onAssign: (dutyId: string) => void;
}

export function useDueDatesColumns(actions: DueDatesTableActions): ColumnDef<DueDateRowDTO>[] {
  const { canAssign, assigningId, onAssign } = actions;
  const t = useTranslations("table.dueDates");

  return useMemo(
    () => [
      {
        accessorKey: "deviceName",
        id: "device",
        header: ({ column }) => <SortHeader label={t("device")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.deviceName}</p>
            <p className="text-xs text-muted-foreground">{row.original.inventoryNumber}</p>
          </div>
        ),
      },
      {
        accessorKey: "inspectionTypeLabel",
        id: "inspectionType",
        header: ({ column }) => <SortHeader label={t("inspectionType")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="text-foreground">{row.original.inspectionTypeLabel}</p>
            <p className="text-xs text-muted-foreground">{row.original.confidenceLabel}</p>
          </div>
        ),
      },
      {
        accessorKey: "basisText",
        id: "basis",
        header: ({ column }) => <SortHeader label={t("base")} column={column} />,
        cell: ({ row }) => (
          <span className="max-w-[280px] text-muted-foreground" title={row.original.basisText}>
            {row.original.basisText}
          </span>
        ),
      },
      {
        accessorKey: "deadlineAnchorLabel",
        id: "anchor",
        header: ({ column }) => <SortHeader label={t("deadlineAnchor")} column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{row.original.deadlineAnchorLabel}</span>
        ),
      },
      {
        accessorKey: "dueAt",
        id: "dueAt",
        header: ({ column }) => <SortHeader label={t("due")} column={column} />,
        cell: ({ row }) => {
          const overdue = row.original.status === "overdue";
          const dueToday = row.original.status === "due";
          return (
            <span className="inline-flex flex-wrap items-center gap-2 whitespace-nowrap">
              <span className={overdue ? "text-destructive" : dueToday ? "text-amber-700 dark:text-amber-400" : ""}>
                {formatDate(row.original.dueAt)}
              </span>
              {overdue ? (
                <Badge variant="secondary" className="uppercase text-amber-700 dark:text-amber-400">
                  overdue
                </Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "lastCompletedAt",
        id: "last",
        header: ({ column }) => <SortHeader label={t("last")} column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.lastCompletedAt)}</span>
        ),
      },
      {
        id: "assignment",
        enableHiding: false,
        header: ({ column }) => <SortHeader label={t("assignment")} column={column} />,
        accessorFn: (row) => row.assignment?.reference ?? "",
        cell: ({ row }) => {
          const assignment = row.original.assignment;
          if (assignment) {
            return (
              <Link
                href={`/requests/${encodeURIComponent(assignment.reference)}`}
                className="font-medium text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
                data-testid="due-date-assignment-link"
              >
                {assignment.reference}
              </Link>
            );
          }
          if (!canAssign) return <span className="text-muted-foreground">—</span>;
          const busy = assigningId === row.original.id;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={Boolean(assigningId)}
              onClick={(e) => {
                e.stopPropagation();
                onAssign(row.original.id);
              }}
              data-testid="due-date-create-assignment"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Create assignment
            </Button>
          );
        },
      },
    ],
    [canAssign, assigningId, onAssign, t],
  );
}
