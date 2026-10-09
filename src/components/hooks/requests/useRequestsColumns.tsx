"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ServiceRequestDTO } from "@/interfaces";
import { formatWhen, serviceRequestStateBadge } from "@/components/hooks/requests";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/lib/locale";

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

export function useRequestsColumns(onOpen: (request: ServiceRequestDTO) => void): ColumnDef<ServiceRequestDTO>[] {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("table.requests");
  const tTable = useTranslations("table");
  const tStatus = useTranslations("status");

  return useMemo(
    () => [
      {
        accessorKey: "reference",
        id: "reference",
        header: ({ column }) => <SortHeader label={t("reference")} column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.reference}</span>,
      },
      {
        id: "device",
        accessorFn: (row) => row.deviceName ?? row.inventoryNumber ?? row.subjectId,
        header: ({ column }) => <SortHeader label={t("device")} column={column} />,
        cell: ({ row }) => {
          const name = row.original.deviceName?.trim() || row.original.subjectId;
          const inv = row.original.inventoryNumber?.trim();
          return (
            <div>
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{inv || "—"}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "serviceType",
        id: "serviceType",
        header: ({ column }) => <SortHeader label={t("service")} column={column} />,
        cell: ({ row }) => row.original.serviceType,
      },
      {
        id: "allocatedTo",
        accessorFn: (row) => row.executorOrg?.name ?? "",
        header: ({ column }) => <SortHeader label={t("allocatedTo")} column={column} />,
        cell: ({ row }) => {
          const org = row.original.executorOrg;
          if (!org) return <span className="text-muted-foreground">—</span>;
          return (
            <div>
              <p className="text-foreground">{org.name}</p>
              <p className="text-xs text-muted-foreground">
                {org.kind === "internal" ? "in-house" : org.kind === "external" ? "external" : org.code}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "state",
        id: "state",
        header: ({ column }) => <SortHeader label={t("status")} column={column} />,
        cell: ({ row }) => {
          const badge = serviceRequestStateBadge(row.original.state);
          const state = row.original.state;
          const known =
            state === "captured" ||
            state === "queued" ||
            state === "transmitted" ||
            state === "acknowledged" ||
            state === "in_progress" ||
            state === "completed" ||
            state === "rejected";
          const label = known ? tStatus(state) : badge.label;
          return (
            <Badge
              variant={badge.variant}
              className={badge.className}
              data-tone={badge.tone}
            >
              {label}
            </Badge>
          );
        },
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.state);
        },
      },
      {
        accessorKey: "raisedBy",
        id: "raisedBy",
        header: ({ column }) => <SortHeader label={t("raisedBy")} column={column} />,
        cell: ({ row }) => row.original.raisedBy ?? "—",
      },
      {
        accessorKey: "locationText",
        id: "location",
        header: ({ column }) => <SortHeader label={t("location")} column={column} />,
        cell: ({ row }) => (
          <span className="max-w-[220px] truncate text-muted-foreground" title={row.original.locationText}>
            {row.original.locationText}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => <SortHeader label={t("created")} column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatWhen(row.original.createdAt, locale)}</span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{tTable("actions")}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const request = row.original;
          return (
            <div className="flex items-center justify-end">
              <OpenButton
                onClick={() => onOpen(request)}
                data-testid="request-open"
                aria-label={`${tTable("open")} ${request.reference}`}
              />
            </div>
          );
        },
      },
    ],
    [locale, onOpen, t, tTable, tStatus],
  );
}
