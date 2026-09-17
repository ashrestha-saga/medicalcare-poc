"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Eye } from "lucide-react";
import type { ServiceRequestDTO } from "@/interfaces";
import { formatWhen, stateTone } from "@/components/hooks/requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function stateBadgeVariant(state: string): "success" | "warning" | "secondary" | "outline" {
  const tone = stateTone(state);
  if (tone === "done") return "success";
  if (tone === "work") return "warning";
  if (tone === "open") return "outline";
  return "secondary";
}

export function useRequestsColumns(onOpen: (request: ServiceRequestDTO) => void): ColumnDef<ServiceRequestDTO>[] {
  return useMemo(
    () => [
      {
        accessorKey: "reference",
        id: "reference",
        header: ({ column }) => <SortHeader label="Reference" column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.reference}</span>,
      },
      {
        accessorKey: "serviceType",
        id: "serviceType",
        header: ({ column }) => <SortHeader label="Service" column={column} />,
        cell: ({ row }) => row.original.serviceType,
      },
      {
        accessorKey: "priority",
        id: "priority",
        header: ({ column }) => <SortHeader label="Priority" column={column} />,
        cell: ({ row }) => row.original.priority ?? "—",
      },
      {
        accessorKey: "state",
        id: "state",
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => (
          <Badge variant={stateBadgeVariant(row.original.state)} data-tone={stateTone(row.original.state)}>
            {row.original.state}
          </Badge>
        ),
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.state);
        },
      },
      {
        accessorKey: "raisedBy",
        id: "raisedBy",
        header: ({ column }) => <SortHeader label="Raised by" column={column} />,
        cell: ({ row }) => row.original.raisedBy ?? "—",
      },
      {
        accessorKey: "locationText",
        id: "location",
        header: ({ column }) => <SortHeader label="Location" column={column} />,
        cell: ({ row }) => (
          <span className="max-w-[220px] truncate text-muted-foreground" title={row.original.locationText}>
            {row.original.locationText}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => <SortHeader label="Created" column={column} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatWhen(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const request = row.original;
          return (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => onOpen(request)}
                      data-testid="request-open"
                      aria-label={`Open ${request.reference}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open request</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [onOpen],
  );
}
