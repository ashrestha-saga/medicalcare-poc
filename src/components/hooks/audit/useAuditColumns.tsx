"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AuditEventDTO } from "@/interfaces";
import { actorKindLabel, auditResourceHref } from "@/lib/audit/resourceHref";
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

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function useAuditColumns(): ColumnDef<AuditEventDTO>[] {
  const t = useTranslations("table.activity");
  const tTable = useTranslations("table");

  return useMemo(
    () => [
      {
        accessorKey: "occurredAt",
        id: "when",
        header: ({ column }) => <SortHeader label={t("when")} column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatWhen(row.original.occurredAt)}</span>
        ),
        sortingFn: (a, b) => a.original.occurredAt.localeCompare(b.original.occurredAt),
      },
      {
        accessorKey: "actorName",
        id: "actor",
        header: ({ column }) => <SortHeader label={t("actor")} column={column} />,
        cell: ({ row }) => (
          <div className="min-w-[10rem]">
            <p className="font-medium text-foreground">{row.original.actorName}</p>
            {row.original.organisationName ? (
              <p className="text-xs text-muted-foreground">{row.original.organisationName}</p>
            ) : null}
            {row.original.actorRole ? (
              <p className="text-xs text-muted-foreground">{row.original.actorRole}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "actorKind",
        id: "actorKind",
        header: ({ column }) => <SortHeader label={t("kind")} column={column} />,
        cell: ({ row }) =>
          row.original.actorKind ? (
            <Badge variant="secondary">{actorKindLabel(row.original.actorKind)}</Badge>
          ) : (
            "—"
          ),
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.actorKind);
        },
      },
      {
        accessorKey: "action",
        id: "action",
        header: ({ column }) => <SortHeader label={t("action")} column={column} />,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span>,
      },
      {
        accessorKey: "resource",
        id: "resource",
        header: ({ column }) => <SortHeader label={t("resource")} column={column} />,
        cell: ({ row }) => (
          <div className="min-w-[8rem]">
            <p className="text-sm">{row.original.resource}</p>
            <p className="max-w-[14rem] truncate font-mono text-[11px] text-muted-foreground">
              {row.original.resourceId}
            </p>
          </div>
        ),
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.resource);
        },
      },
      {
        accessorKey: "summary",
        id: "summary",
        header: ({ column }) => <SortHeader label={t("summary")} column={column} />,
        cell: ({ row }) => <span className="max-w-[28rem] text-sm">{row.original.summary}</span>,
      },
      {
        id: "open",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{tTable("open")}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const href = auditResourceHref(row.original.resource, row.original.resourceId);
          if (!href) return null;
          return (
            <Link
              href={href}
              className="text-sm text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {tTable("open")}
            </Link>
          );
        },
      },
    ],
    [t, tTable],
  );
}
