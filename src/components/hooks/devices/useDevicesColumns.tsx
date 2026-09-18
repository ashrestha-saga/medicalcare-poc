"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Eye, Pencil, Printer } from "lucide-react";
import type { DeviceInstanceDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
        header: ({ column }) => <SortHeader label="Inventory #" column={column} />,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.inventoryNumber}</span>
        ),
      },
      {
        accessorKey: "serialNumber",
        id: "serialNumber",
        header: ({ column }) => <SortHeader label="Serial" column={column} />,
        cell: ({ row }) => row.original.serialNumber ?? "—",
      },
      {
        id: "product",
        accessorFn: (row) => row.tradeName ?? row.modelName ?? "",
        header: ({ column }) => <SortHeader label="Product" column={column} />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.tradeName ?? row.original.modelName ?? "—"}</div>
            {row.original.manufacturer && (
              <div className="truncate text-xs text-muted-foreground">{row.original.manufacturer}</div>
            )}
          </div>
        ),
      },
      {
        id: "location",
        accessorFn: (row) => row.location?.text ?? "",
        header: ({ column }) => <SortHeader label="Location" column={column} />,
        cell: ({ row }) => (
          <span className="max-w-[240px] truncate text-muted-foreground" title={row.original.location?.text ?? undefined}>
            {row.original.location?.text ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "responsiblePerson",
        id: "responsible",
        header: ({ column }) => <SortHeader label="Responsible" column={column} />,
        cell: ({ row }) => row.original.responsiblePerson ?? "—",
      },
      {
        accessorKey: "commissionedAt",
        id: "commissionedAt",
        header: ({ column }) => <SortHeader label="Commissioned" column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.commissionedAt)}
          </span>
        ),
      },
      {
        id: "maintenanceDue",
        accessorFn: (row) => row.nextMaintenanceDueAt ?? "",
        header: ({ column }) => <SortHeader label="Maint. due" column={column} />,
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
            <span className={`whitespace-nowrap ${tone}`} data-testid="device-maint-due-cell">
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
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const device = row.original;
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
                      aria-label={`Open ${device.inventoryNumber}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open</TooltipContent>
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
                {canUpdate && (
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
    [canUpdate, onOpen, onEdit, onPrint],
  );
}
