"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DueDatesBoardFilter, DueDatesSummaryDTO } from "@/interfaces";

function SummaryCard({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
  testId,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "warning" | "default";
  active?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left" data-testid={testId}>
      <Card
        className={cn(
          "h-full shadow-none transition-colors",
          active ? "border-foreground/40 bg-muted/40" : "bg-card",
        )}
      >
        <CardContent className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-foreground",
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </button>
  );
}

interface DueDatesSummaryProps {
  summary: DueDatesSummaryDTO;
  filter: DueDatesBoardFilter;
  onFilter: (filter: DueDatesBoardFilter) => void;
}

export function DueDatesSummary({ summary, filter, onFilter }: DueDatesSummaryProps) {
  const t = useTranslations("dueDatesCards");
  const toggle = (next: DueDatesBoardFilter) => onFilter(filter === next ? "all" : next);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="due-dates-summary">
      <SummaryCard
        label={t("due")}
        value={summary.due}
        hint={t("dueHint")}
        active={filter === "due"}
        onClick={() => toggle("due")}
        testId="due-dates-card-due"
      />
      <SummaryCard
        label={t("overdue")}
        value={summary.overdue}
        hint={t("overdueHint")}
        tone="warning"
        active={filter === "overdue"}
        onClick={() => toggle("overdue")}
        testId="due-dates-card-overdue"
      />
      <SummaryCard
        label={t("unassigned")}
        value={summary.unassigned}
        hint={t("unassignedHint")}
        active={filter === "unassigned"}
        onClick={() => toggle("unassigned")}
        testId="due-dates-card-unassigned"
      />
      <SummaryCard
        label={t("open")}
        value={summary.openAssignments}
        hint={t("openHint")}
        active={filter === "open"}
        onClick={() => toggle("open")}
        testId="due-dates-card-open"
      />
    </div>
  );
}
