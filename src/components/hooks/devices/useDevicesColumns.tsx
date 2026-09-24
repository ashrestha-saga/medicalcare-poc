"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Eye, Pencil, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DeviceInstanceDTO } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

function inventoryStateBadge(state: DeviceInstanceDTO["state"]): {
  label: string;
  variant: "success" | "warning" | "destructive" | "secondary";
} {
  if (state === "released") return { label: "RELEASED", variant: "success" };
  if (state === "review") return { label: "REVIEW", variant: "warning" };
  if (state === "retired") return { label: "RETIRED", variant: "secondary" };
  return { label: "DRAFT", variant: "destructive" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export interface DevicesTableActions {
  canUpdate: boolean;
  onOpen: (device: DeviceInstanceDTO) => void;
  onEdit: (device: DeviceInstanceDTO) => void;
  onPrint: (device: DeviceInstanceDTO) => void;
}

export function useDevicesColumns(actions: DevicesTableActions): ColumnDef<DeviceInstanceDTO>[] {
  const { canUpdate, onOpen, onEdit, onPrint } = actions;
  const t = useTranslations("table.devices");
  const tTable = useTranslations("table");

  return useMemo(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all on page"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.inventoryNumber}`}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        meta: { className: "w-[1%] whitespace-nowrap pr-0" },
      },
      {
        accessorKey: "inventoryNumber",
        id: "inventoryNumber",
        header: ({ column }) => <SortHeader label={t("inventoryNumber")} column={column} />,
        cell: ({ row }) => {
          const pending = row.original.catalogPending;
          return (
            <div className={pending ? "opacity-50" : undefined} data-catalog-pending={pending ? "1" : undefined}>
              <span className="font-medium text-foreground">{row.original.inventoryNumber}</span>
              {pending ? (
                <Badge
                  variant="outline"
                  className="mt-1 border-transparent bg-[rgba(245,165,36,0.15)] text-[10px] uppercase text-[var(--warn)]"
                >
                  Under review
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "product",
        accessorFn: (row) =>
          [row.tradeName ?? row.modelName ?? "", row.manufacturer ?? "", row.serialNumber ?? ""]
            .filter(Boolean)
            .join(" "),
        header: ({ column }) => <SortHeader label={t("product")} column={column} />,
        cell: ({ row }) => {
          const d = row.original;
          const sub = [d.manufacturer?.trim(), d.serialNumber?.trim()].filter(Boolean).join(" · ");
          return (
            <div className={`min-w-0${d.catalogPending ? " opacity-50" : ""}`}>
              <div className="truncate font-medium">{d.tradeName ?? d.modelName ?? "—"}</div>
              {sub ? (
                <div className="truncate text-xs text-muted-foreground">{sub}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "classification",
        accessorFn: (row) => row.inspectionTags.join(" "),
        header: ({ column }) => <SortHeader label={t("classification")} column={column} />,
        cell: ({ row }) => {
          const tags = row.original.inspectionTags;
          const pending = row.original.catalogPending;
          if (!tags.length) {
            return (
              <span className={`text-muted-foreground${pending ? " opacity-50" : ""}`}>—</span>
            );
          }
          return (
            <div className={`flex flex-wrap gap-1${pending ? " opacity-50" : ""}`}>
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "font-medium uppercase",
                    tag.startsWith("SW")
                      ? "border-transparent bg-[rgba(47,217,138,0.14)] text-[var(--green)]"
                      : tag === "STRLSCHV"
                        ? "border-transparent bg-[rgba(245,165,36,0.15)] text-[var(--warn)]"
                        : "border-transparent bg-[rgba(30,127,224,0.14)] text-[var(--accent)]",
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "location",
        accessorFn: (row) => row.location?.text ?? "",
        header: ({ column }) => <SortHeader label={t("location")} column={column} />,
        cell: ({ row }) => (
          <span
            className={`max-w-[240px] truncate text-muted-foreground${row.original.catalogPending ? " opacity-50" : ""}`}
            title={row.original.location?.text ?? undefined}
          >
            {row.original.location?.text ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "responsiblePerson",
        id: "responsible",
        header: ({ column }) => <SortHeader label={t("responsible")} column={column} />,
        cell: ({ row }) => (
          <span className={row.original.catalogPending ? "opacity-50" : undefined}>
            {row.original.responsiblePerson ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "state",
        id: "state",
        header: ({ column }) => <SortHeader label={t("state")} column={column} />,
        cell: ({ row }) => {
          const badge = inventoryStateBadge(row.original.state);
          return (
            <Badge
              variant={badge.variant}
              className={row.original.catalogPending ? "opacity-50" : undefined}
              data-testid="device-state-badge"
            >
              {badge.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "commissionedAt",
        id: "commissionedAt",
        header: ({ column }) => <SortHeader label={t("commissioned")} column={column} />,
        cell: ({ row }) => (
          <span
            className={`whitespace-nowrap text-muted-foreground${row.original.catalogPending ? " opacity-50" : ""}`}
          >
            {formatDate(row.original.commissionedAt)}
          </span>
        ),
      },
      {
        id: "maintenanceDue",
        accessorFn: (row) => row.nextMaintenanceDueAt ?? "",
        header: ({ column }) => <SortHeader label={t("maintDue")} column={column} />,
        cell: ({ row }) => {
          const status = row.original.maintenanceStatus;
          const due = formatDate(row.original.nextMaintenanceDueAt);
          const tone =
            status === "overdue"
              ? "text-destructive"
              : status === "due"
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground";
          return (
            <span
              className={`whitespace-nowrap ${tone}${row.original.catalogPending ? " opacity-50" : ""}`}
              data-testid="device-maint-due-cell"
            >
              {due}
              {status !== "unset" && status !== "ok" ? ` · ${status}` : ""}
            </span>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{tTable("actions")}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const device = row.original;
          const canEditRow = canUpdate && !device.catalogPending;
          return (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[var(--accent)] hover:bg-[rgba(30,127,224,0.14)] hover:text-[var(--accent)]"
                      onClick={() => onOpen(device)}
                      data-testid="device-open"
                      aria-label={`${tTable("open")} ${device.inventoryNumber}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tTable("open")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[var(--accent)] hover:bg-[rgba(30,127,224,0.14)] hover:text-[var(--accent)]"
                      onClick={() => onPrint(device)}
                      data-testid="device-print"
                      aria-label={`Print label ${device.inventoryNumber}`}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print label</TooltipContent>
                </Tooltip>
                {canEditRow && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--accent)] hover:bg-[rgba(30,127,224,0.14)] hover:text-[var(--accent)]"
                        onClick={() => onEdit(device)}
                        data-testid="device-edit"
                        aria-label={`Edit ${device.inventoryNumber}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [canUpdate, onOpen, onEdit, onPrint, t, tTable],
  );
}
