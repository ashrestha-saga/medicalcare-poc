"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { MySitesInstitutionDTO } from "@/interfaces/console";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { Badge } from "@/components/ui/badge";

export function useMySitesColumns(
  onOpen: (row: MySitesInstitutionDTO) => void,
): ColumnDef<MySitesInstitutionDTO>[] {
  const t = useTranslations("console");

  return useMemo(
    () => [
      {
        id: "institution",
        accessorKey: "tenantName",
        header: t("mySitesColInstitution"),
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-foreground">{row.original.tenantName}</p>
            <p className="text-xs text-muted-foreground">{row.original.tenantCode ?? "—"}</p>
          </div>
        ),
      },
      {
        id: "location",
        accessorKey: "location",
        header: t("mySitesColLocation"),
        cell: ({ row }) => (
          <span className="text-foreground">{row.original.location ?? "—"}</span>
        ),
      },
      {
        id: "distance",
        accessorKey: "distanceBand",
        header: t("mySitesColDistance"),
        cell: ({ row }) => {
          const band = row.original.distanceBand;
          if (band === "unknown") return <span className="text-muted-foreground">—</span>;
          return (
            <Badge variant={band === "nah" ? "success" : band === "mittel" ? "secondary" : "warning"}>
              {t(`mySitesDistance_${band}` as "mySitesDistance_nah")}
            </Badge>
          );
        },
      },
      {
        id: "inspections",
        accessorKey: "inspectionCount",
        header: t("mySitesColInspections"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{row.original.inspectionCount}</span>
            {row.original.overdueCount > 0 ? (
              <Badge variant="destructive">
                {t("mySitesOverdue", { count: row.original.overdueCount })}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "nextDue",
        accessorKey: "nextDue",
        header: t("mySitesColNextDue"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.nextDue ?? "—"}</span>
        ),
      },
      {
        id: "assignees",
        header: t("mySitesColAssignedTo"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.assignees.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              row.original.assignees.map((a) => (
                <Badge key={a.userId} variant="secondary">
                  {a.name}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("mySitesOpen")}</span>,
        enableSorting: false,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => <OpenButton onClick={() => onOpen(row.original)} />,
      },
    ],
    [onOpen, t],
  );
}
