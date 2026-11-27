"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { OrderRequestDTO } from "@/interfaces";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/cart";
import { formatDateTime } from "@/lib/format";
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

function stateVariant(state: string | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (state === "ordered" || state === "shipped") return "default";
  if (state === "failed" || state === "cancelled" || state === "expired") return "destructive";
  if (state === "submitting") return "secondary";
  return "outline";
}

export function useShopOrdersColumns(
  onOpen: (order: OrderRequestDTO) => void,
): ColumnDef<OrderRequestDTO>[] {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("table.shopOrders");
  const tStatus = useTranslations("shopOrderStatus");
  const tPurpose = useTranslations("pages.shopOrders.purpose");

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
        accessorFn: (row) => row.device?.label ?? "",
        header: ({ column }) => <SortHeader label={t("device")} column={column} />,
        cell: ({ row }) => {
          const device = row.original.device;
          const purpose = row.original.purpose === "device" ? tPurpose("device") : tPurpose("parts");
          if (!device) {
            return (
              <span className="text-muted-foreground" data-testid={`shop-order-device-none-${row.original.reference}`}>
                —
              </span>
            );
          }
          return (
            <div className="min-w-[10rem]" data-testid={`shop-order-device-${device.id}`}>
              <Link
                href={device.href}
                className="font-medium text-foreground underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {device.label}
              </Link>
              <p className="text-xs text-muted-foreground">{purpose}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "externalOrderRef",
        id: "externalOrderRef",
        header: ({ column }) => <SortHeader label={t("shopOrder")} column={column} />,
        cell: ({ row }) => row.original.externalOrderRef ?? "—",
      },
      {
        accessorKey: "externalState",
        id: "externalState",
        header: ({ column }) => <SortHeader label={t("status")} column={column} />,
        cell: ({ row }) => {
          const state = row.original.externalState ?? "intent";
          const known = [
            "intent",
            "submitting",
            "ordered",
            "shipped",
            "cancelled",
            "failed",
            "expired",
          ].includes(state);
          return (
            <Badge variant={stateVariant(state)} data-testid={`shop-order-state-${state}`}>
              {known ? tStatus(state as "ordered") : state}
            </Badge>
          );
        },
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.externalState ?? "intent");
        },
      },
      {
        accessorKey: "orderedByName",
        id: "orderedByName",
        header: ({ column }) => <SortHeader label={t("orderedBy")} column={column} />,
        cell: ({ row }) => row.original.orderedByName || row.original.raisedBy || "—",
      },
      {
        id: "items",
        accessorFn: (row) => row.itemCount ?? row.items.length,
        header: ({ column }) => <SortHeader label={t("items")} column={column} />,
        cell: ({ row }) => row.original.itemCount ?? row.original.items.length,
      },
      {
        id: "total",
        accessorFn: (row) => row.netTotalFromSource ?? 0,
        header: ({ column }) => <SortHeader label={t("total")} column={column} />,
        cell: ({ row }) => {
          const total = row.original.netTotalFromSource;
          if (total == null) return "—";
          return formatMoney(total, row.original.currency ?? "EUR", locale === "de" ? "de-DE" : "en-US");
        },
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => <SortHeader label={t("created")} column={column} />,
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">{t("actions")}</span>,
        cell: ({ row }) => (
          <OpenButton
            onClick={() => onOpen(row.original)}
            data-testid={`shop-order-open-${row.original.reference}`}
          />
        ),
      },
    ],
    [locale, onOpen, t, tPurpose, tStatus],
  );
}
