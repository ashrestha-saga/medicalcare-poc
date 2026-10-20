"use client";

import { useTranslations } from "next-intl";
import type {
  ClarificationIssue,
  ClarificationIssueCode,
  ClarificationItemDTO,
  ClarificationSeverity,
  ClarificationSummaryDTO,
} from "@/interfaces";
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

function severityLabelKey(severity: ClarificationSeverity): "severityHigh" | "severityMedium" | "severityLow" {
  if (severity === "high") return "severityHigh";
  if (severity === "medium") return "severityMedium";
  return "severityLow";
}

function translateIssue(
  t: ReturnType<typeof useTranslations<"clarificationsIssues">>,
  issue: ClarificationIssue,
): string {
  // C3 deferred rows keep custom English labels with actor context.
  if (issue.label.includes("deferred by")) {
    return issue.label;
  }

  switch (issue.code) {
    case "not_released": {
      const lower = issue.label.toLowerCase();
      if (lower.includes("review")) return t("not_released_review");
      return t("not_released_draft");
    }
    case "duplicate_serial": {
      const match = issue.label.match(/\(([^)]+)\)/);
      if (match?.[1]) return t("duplicate_serial", { peers: match[1] });
      return issue.label;
    }
    case "missing_responsible":
    case "missing_maintenance_cycle":
    case "missing_classification":
    case "derived_classification":
    case "missing_room":
    case "missing_model_name":
    case "missing_serial":
      return t(issue.code);
    default:
      return issue.label;
  }
}

function SummaryCard({
  value,
  label,
  hint,
  active,
  onClick,
  testId,
}: {
  value: number;
  label: string;
  hint: string;
  active?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left"
      data-testid={testId}
      aria-pressed={active}
    >
      <div
        className={cn(
          "rounded-md border bg-card/40 px-4 py-3 transition-colors",
          active ? "border-foreground/40 bg-muted/40" : "border-border",
        )}
        data-testid="clarification-summary-card"
      >
        <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{value}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </button>
  );
}

interface ClarificationsListProps {
  summary: ClarificationSummaryDTO;
  items: ClarificationItemDTO[];
  loading: boolean;
  canEdit: boolean;
  issue: ClarificationIssueCode | null;
  severity: ClarificationSeverity | null;
  onIssueChange: (issue: ClarificationIssueCode | null) => void;
  onSeverityChange: (severity: ClarificationSeverity | null) => void;
  onClearFilters: () => void;
  onEdit: (item: ClarificationItemDTO) => void;
}

export function ClarificationsList({
  summary,
  items,
  loading,
  canEdit,
  issue,
  severity,
  onIssueChange,
  onSeverityChange,
  onClearFilters,
  onEdit,
}: ClarificationsListProps) {
  const t = useTranslations("pages.clarifications");
  const tIssues = useTranslations("clarificationsIssues");
  const tFilters = useTranslations("filters");

  const toggleIssue = (code: ClarificationIssueCode | null) => {
    onIssueChange(issue === code ? null : code);
  };

  const hasFilters = Boolean(issue || severity);

  return (
    <div className="space-y-4" data-testid="clarifications-list">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          value={summary.openCases}
          label={t("openCases")}
          hint={t("openCasesHint")}
          active={!issue && !severity}
          onClick={() => onClearFilters()}
          testId="clarification-card-open"
        />
        <SummaryCard
          value={summary.duplicates}
          label={t("duplicates")}
          hint={t("duplicatesHint")}
          active={issue === "duplicate_serial"}
          onClick={() => toggleIssue("duplicate_serial")}
          testId="clarification-card-duplicates"
        />
        <SummaryCard
          value={summary.derivedClassification}
          label={t("derived")}
          hint={t("derivedHint")}
          active={issue === "derived_classification"}
          onClick={() => toggleIssue("derived_classification")}
          testId="clarification-card-derived"
        />
        <SummaryCard
          value={summary.missingResponsible}
          label={t("missingResponsible")}
          hint={t("missingResponsibleHint")}
          active={issue === "missing_responsible"}
          onClick={() => toggleIssue("missing_responsible")}
          testId="clarification-card-responsible"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["high", "medium", "low"] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={severity === s ? "default" : "outline"}
            className="h-8"
            onClick={() => onSeverityChange(severity === s ? null : s)}
            data-testid={`clarification-severity-${s}`}
          >
            {tIssues(severityLabelKey(s))}
          </Button>
        ))}
        {hasFilters ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={onClearFilters}
            data-testid="clarification-filters-clear"
          >
            {tFilters("clearAll")}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="py-8 text-sm text-muted-foreground">{t("loading")}</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
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
                      {tIssues(severityLabelKey(item.severity))}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.inventoryNumber}
                    {item.locationText ? ` · ${item.locationText}` : ""}
                    {item.serialNumber ? ` · SN ${item.serialNumber}` : ""}
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    {item.issues.length > 0
                      ? item.issues.map((iss) => translateIssue(tIssues, iss)).join(" · ")
                      : item.reasonText}
                  </p>
                  {item.sourceLabel && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("modelSource", { source: item.sourceLabel })}
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
                  {t("edit")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md border border-border border-l-4 border-l-[var(--accent)] bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        {t("footer")}
      </div>
    </div>
  );
}
