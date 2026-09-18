"use client";

import type { ClarificationItemDTO, ClarificationSeverity, ClarificationSummaryDTO } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function severityAccent(severity: ClarificationSeverity): string {
  switch (severity) {
    case "high":
      return "border-l-rose-500 bg-rose-500/5";
    case "medium":
      return "border-l-amber-500 bg-amber-500/5";
    default:
      return "border-l-yellow-400 bg-yellow-400/5";
  }
}

function severityBadge(severity: ClarificationSeverity): "destructive" | "secondary" | "outline" {
  if (severity === "high") return "destructive";
  if (severity === "medium") return "secondary";
  return "outline";
}

function SummaryCard({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 px-4 py-3" data-testid="clarification-summary-card">
      <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

interface ClarificationsListProps {
  summary: ClarificationSummaryDTO;
  items: ClarificationItemDTO[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (item: ClarificationItemDTO) => void;
}

export function ClarificationsList({
  summary,
  items,
  loading,
  canEdit,
  onEdit,
}: ClarificationsListProps) {
  return (
    <div className="space-y-4 px-4 pb-6 sm:px-[18px]" data-testid="clarifications-list">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          value={summary.openCases}
          label="Open cases"
          hint="Devices with at least one issue"
        />
        <SummaryCard
          value={summary.duplicates}
          label="Possible duplicates"
          hint="Same serial on another unit"
        />
        <SummaryCard
          value={summary.derivedClassification}
          label="Derived classification"
          hint="Not verified on the model"
        />
        <SummaryCard
          value={summary.missingResponsible}
          label="Missing responsible"
          hint="No device administrator linked"
        />
      </div>

      {loading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading clarifications…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No clarification items — inventory records look complete.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={item.deviceId}
              className={cn(
                "flex flex-col gap-3 rounded-md border border-border border-l-4 bg-card/40 p-4 sm:flex-row sm:items-start sm:justify-between",
                severityAccent(item.severity),
              )}
              data-testid="clarification-item"
            >
              <div className="flex min-w-0 gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                    item.severity === "high"
                      ? "bg-rose-500"
                      : item.severity === "medium"
                        ? "bg-amber-500"
                        : "bg-yellow-500",
                  )}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-foreground">{item.title}</h3>
                    <Badge variant={severityBadge(item.severity)} className="uppercase">
                      {item.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.inventoryNumber}
                    {item.locationText ? ` · ${item.locationText}` : ""}
                    {item.serialNumber ? ` · SN ${item.serialNumber}` : ""}
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{item.reasonText}</p>
                  {item.sourceLabel && (
                    <p className="text-[11px] text-muted-foreground">
                      Model source: {item.sourceLabel}
                    </p>
                  )}
                </div>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => onEdit(item)}
                  data-testid="clarification-edit"
                >
                  Edit
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md border border-border border-l-4 border-l-[var(--accent)] bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        Fix missing fields and duplicates here or in Inventory. Classification quality is maintained on
        the linked catalog model.
      </div>
    </div>
  );
}
