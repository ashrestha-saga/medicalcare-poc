"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Eye, Pencil } from "lucide-react";
import type { CatalogBadgeDisplay, CatalogModelListItemDTO, CatalogTableActions } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { catalogShortId } from "./catalogDisplay";

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

export function catalogStateBadge(state: CatalogModelListItemDTO["state"]): CatalogBadgeDisplay {
  if (state === "released") return { label: "RELEASED", variant: "success" };
  if (state === "review") return { label: "UNDER REVIEW", variant: "warning" };
  return { label: "DRAFT", variant: "destructive" };
}

export function catalogSourceBadge(source: CatalogModelListItemDTO["source"]): CatalogBadgeDisplay {
  if (source === "catalog") {
    return { label: "CATALOG", className: "border-[rgba(47,217,138,0.45)] text-[var(--green)]" };
  }
  if (source === "beudamed") {
    return { label: "BEUDAMED", className: "border-[rgba(30,127,224,0.45)] text-[var(--accent)]" };
  }
  return { label: "MANUAL", className: "border-border text-muted-foreground" };
}

export function catalogConfidenceBadge(confidence: string | null | undefined): CatalogBadgeDisplay | null {
  const value = confidence?.toLowerCase();
  if (value === "verified") {
    return { label: "VERIFIED", className: "border-[rgba(47,217,138,0.45)] text-[var(--green)]" };
  }
  if (value === "derived") {
    return { label: "DERIVED", className: "border-[rgba(245,165,36,0.5)] text-[var(--warn)]" };
  }
  if (value === "guess") {
    return { label: "GUESS", className: "border-border text-muted-foreground" };
  }
  return null;
}

export function catalogClassificationBadges(model: CatalogModelListItemDTO): CatalogBadgeDisplay[] {
  const c = model.classification;
  const badges: CatalogBadgeDisplay[] = [];
  if (c?.annex1) {
    badges.push({ label: "ANNEX 1", className: "border-transparent bg-[rgba(30,127,224,0.14)] text-[var(--accent)]" });
  }
  if (c?.annex2) {
    badges.push({ label: "ANNEX 2", className: "border-transparent bg-[rgba(30,127,224,0.14)] text-[var(--accent)]" });
  }
  if (c?.softwareClass) {
    badges.push({
      label: `SW ${c.softwareClass.toUpperCase()}`,
      className: "border-transparent bg-[rgba(47,217,138,0.14)] text-[var(--green)]",
    });
  }
  if (c?.radiation) {
    badges.push({
      label: "STRLSCHV",
      className: "border-transparent bg-[rgba(245,165,36,0.15)] text-[var(--warn)]",
    });
  }
  if (!badges.length && model.riskClass) {
    badges.push({
      label: model.riskClass.toUpperCase(),
      className: "border-transparent bg-muted text-muted-foreground",
    });
  }
  return badges;
}

export function useCatalogColumns(actions: CatalogTableActions): ColumnDef<CatalogModelListItemDTO>[] {
  const { canUpdate, onOpen, onEdit } = actions;

  return useMemo(
    () => [
      {
        accessorKey: "state",
        id: "status",
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => {
          const badge = catalogStateBadge(row.original.state);
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      {
        id: "model",
        accessorFn: (row) => row.displayName,
        header: ({ column }) => <SortHeader label="Model" column={column} />,
        cell: ({ row }) => {
          const m = row.original;
          const meta = [catalogShortId(m.id), m.manufacturer, `v${m.version}`].filter(Boolean).join(" · ");
          return (
            <div className="min-w-[220px] max-w-[320px]">
              <div className="truncate font-medium text-foreground">{m.displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{meta}</div>
            </div>
          );
        },
      },
      {
        id: "classification",
        enableSorting: false,
        header: () => <span className="text-xs font-medium text-muted-foreground">Classification</span>,
        cell: ({ row }) => {
          const badges = catalogClassificationBadges(row.original);
          if (!badges.length) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <Badge key={b.label} variant="outline" className={cn("font-medium uppercase", b.className)}>
                  {b.label}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "source",
        accessorKey: "source",
        header: ({ column }) => <SortHeader label="Source" column={column} />,
        cell: ({ row }) => {
          const badge = catalogSourceBadge(row.original.source);
          return (
            <Badge variant="outline" className={cn("font-medium uppercase", badge.className)}>
              {badge.label}
            </Badge>
          );
        },
      },
      {
        id: "confidence",
        accessorFn: (row) => row.classification?.confidence ?? "",
        header: ({ column }) => <SortHeader label="Confidence" column={column} />,
        cell: ({ row }) => {
          const badge = catalogConfidenceBadge(row.original.classification?.confidence);
          if (!badge) return <span className="text-muted-foreground">—</span>;
          return (
            <Badge variant="outline" className={cn("font-medium uppercase", badge.className)}>
              {badge.label}
            </Badge>
          );
        },
      },
      {
        id: "gtin",
        accessorKey: "gtinCoverage",
        header: ({ column }) => <SortHeader label="GTIN" column={column} />,
        cell: ({ row }) => {
          const value = row.original.gtinCoverage;
          const color =
            value >= 100 ? "bg-[var(--green)]" : value > 0 ? "bg-[var(--warn)]" : "bg-muted-foreground/30";
          return (
            <div className="w-[88px] space-y-1">
              <Progress value={value} indicatorClassName={color} className="h-1.5" />
              <div className="text-[11px] text-muted-foreground">{value}%</div>
            </div>
          );
        },
      },
      {
        accessorKey: "siteCount",
        id: "sites",
        header: ({ column }) => <SortHeader label="Sites" column={column} />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.siteCount}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const model = row.original;
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
                      onClick={() => onOpen(model)}
                      data-testid="catalog-open"
                      aria-label={`Open ${model.displayName}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open</TooltipContent>
                </Tooltip>
                {canUpdate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--accent)] hover:bg-[rgba(30,127,224,0.14)] hover:text-[var(--accent)]"
                        onClick={() => onEdit(model)}
                        data-testid="catalog-edit"
                        aria-label={`Edit ${model.displayName}`}
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
    [canUpdate, onEdit, onOpen],
  );
}
