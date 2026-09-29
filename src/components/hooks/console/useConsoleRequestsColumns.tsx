"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestRowDTO } from "@/interfaces/console";
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

export function useConsoleRequestsColumns(): ColumnDef<ConsoleRequestRowDTO>[] {
  const t = useTranslations("console");

  return useMemo(
    () => [
      {
        accessorKey: "reference",
        id: "reference",
        header: ({ column }) => <SortHeader label={t("colReference")} column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">{row.original.reference}</span>
        ),
      },
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
        accessorKey: "deviceLabel",
        id: "device",
        header: ({ column }) => <SortHeader label={t("colDevice")} column={column} />,
        cell: ({ row }) => <span className="text-foreground">{row.original.deviceLabel}</span>,
      },
      {
        accessorKey: "serviceType",
        id: "service",
        header: ({ column }) => <SortHeader label={t("colService")} column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.serviceType}</span>
        ),
      },
      {
        accessorKey: "executorName",
        id: "executor",
        header: ({ column }) => <SortHeader label={t("colExecutor")} column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.executorName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "state",
        id: "state",
        header: ({ column }) => <SortHeader label={t("colState")} column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.state}</span>
        ),
      },
    ],
    [t],
  );
}
