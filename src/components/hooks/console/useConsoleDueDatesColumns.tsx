"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleDutyRowDTO } from "@/interfaces/console";
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

export function useConsoleDueDatesColumns(): ColumnDef<ConsoleDutyRowDTO>[] {
  const t = useTranslations("console");

  return useMemo(
    () => [
      {
        accessorKey: "tenantName",
        id: "tenant",
        header: ({ column }) => <SortHeader label={t("colTenant")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.tenantName}</p>
            <p className="text-xs text-muted-foreground">{row.original.tenantCode ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "inventoryNumber",
        id: "inventory",
        header: ({ column }) => <SortHeader label={t("colInventory")} column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.inventoryNumber ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "deviceLabel",
        id: "device",
        header: ({ column }) => <SortHeader label={t("colDevice")} column={column} />,
        cell: ({ row }) => <span className="text-foreground">{row.original.deviceLabel}</span>,
      },
      {
        id: "duty",
        accessorFn: (row) => row.title ?? row.dutyKey,
        header: ({ column }) => <SortHeader label={t("colDuty")} column={column} />,
        cell: ({ row }) => (
          <span className="text-foreground">{row.original.title ?? row.original.dutyKey}</span>
        ),
      },
      {
        accessorKey: "deadlineAnchor",
        id: "anchor",
        header: ({ column }) => <SortHeader label={t("colAnchor")} column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.deadlineAnchor}</span>
        ),
      },
      {
        accessorKey: "dueAt",
        id: "due",
        header: ({ column }) => <SortHeader label={t("colDue")} column={column} />,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-xs",
              row.original.overdue && "font-semibold text-destructive",
            )}
          >
            {formatDate(row.original.dueAt)}
          </span>
        ),
      },
      {
        accessorKey: "confidence",
        id: "confidence",
        header: ({ column }) => <SortHeader label={t("colConfidence")} column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.confidence}</span>
        ),
      },
    ],
    [t],
  );
}
