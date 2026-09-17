"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import type { SiteDTO } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface LocationsTableActions {
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (site: SiteDTO) => void;
  onDelete: (site: SiteDTO) => void;
}

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

export function useLocationsColumns(actions: LocationsTableActions): ColumnDef<SiteDTO>[] {
  const { canUpdate, canDelete, onEdit, onDelete } = actions;

  return useMemo(
    () => [
      {
        accessorKey: "code",
        id: "code",
        header: ({ column }) => <SortHeader label="Identifier" column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.code ?? "—"}</span>
        ),
      },
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => <SortHeader label="Designation" column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "address",
        id: "address",
        header: ({ column }) => <SortHeader label="Address" column={column} />,
        cell: ({ row }) => (
          <span className="max-w-[220px] truncate text-muted-foreground" title={row.original.address ?? undefined}>
            {row.original.address ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "deliveryAddress",
        id: "deliveryAddress",
        header: ({ column }) => <SortHeader label="Delivery address" column={column} />,
        cell: ({ row }) => (
          <span
            className="max-w-[240px] truncate text-muted-foreground"
            title={row.original.deliveryAddress ?? undefined}
          >
            {row.original.deliveryAddress ?? "—"}
          </span>
        ),
      },
      {
        id: "areas",
        accessorFn: (row) => row.areas.map((a) => a.name).join(", "),
        enableSorting: false,
        header: () => <span className="text-xs font-medium text-muted-foreground">Areas</span>,
        cell: ({ row }) => {
          const areas = row.original.areas;
          if (!areas.length) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex max-w-[280px] flex-wrap gap-1">
              {areas.map((area) => (
                <Badge key={area.id} variant="secondary" className="font-normal">
                  {area.name}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "deviceCount",
        id: "devices",
        header: ({ column }) => <SortHeader label="Devices" column={column} />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.deviceCount}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const site = row.original;
          return (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {canUpdate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--accent)] hover:bg-[rgba(30,127,224,0.14)] hover:text-[var(--accent)]"
                        onClick={() => onEdit(site)}
                        data-testid="location-edit"
                        aria-label={`Edit ${site.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--red)] hover:bg-[rgba(255,51,102,0.14)] hover:text-[var(--red)]"
                        onClick={() => onDelete(site)}
                        data-testid="location-delete"
                        aria-label={`Delete ${site.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [canUpdate, canDelete, onEdit, onDelete],
  );
}
