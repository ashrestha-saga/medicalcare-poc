import type {
  ClarificationIssue,
  ClarificationIssueCode,
  ClarificationSeverity,
} from "@/interfaces";

const SEVERITY_RANK: Record<ClarificationSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function maxSeverity(issues: ClarificationIssue[]): ClarificationSeverity {
  let best: ClarificationSeverity = "low";
  for (const issue of issues) {
    if (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[best]) best = issue.severity;
  }
  return best;
}

export function issue(
  code: ClarificationIssueCode,
  label: string,
  severity: ClarificationSeverity,
): ClarificationIssue {
  return { code, label, severity };
}

export interface ClarificationEvalInput {
  responsibleUserId: string | null;
  responsiblePerson: string | null;
  maintenanceCycleMonths: number | null;
  room: string | null;
  serialNumber: string | null;
  modelName: string | null;
  tradeName: string | null;
  /** Latest model classification proposal confidence, if any. */
  classificationConfidence: string | null;
  hasClassificationProposal: boolean;
  /** Other inventory numbers sharing this serial (same tenant). */
  duplicateSerialInventoryNumbers: string[];
}

/** Pure rules — keep in sync with Klärliste product rules. */
export function evaluateClarificationIssues(input: ClarificationEvalInput): ClarificationIssue[] {
  const issues: ClarificationIssue[] = [];

  if (!input.responsibleUserId?.trim() && !input.responsiblePerson?.trim()) {
    issues.push(issue("missing_responsible", "Responsible person missing", "low"));
  }

  if (input.maintenanceCycleMonths == null || input.maintenanceCycleMonths <= 0) {
    issues.push(issue("missing_maintenance_cycle", "Maintenance cycle missing", "medium"));
  }

  if (!input.hasClassificationProposal) {
    issues.push(issue("missing_classification", "No classification on model", "medium"));
  } else {
    const conf = input.classificationConfidence?.toLowerCase() ?? "";
    if (conf === "derived" || conf === "guess") {
      issues.push(
        issue(
          "derived_classification",
          conf === "guess" ? "Classification is only a guess" : "Classification only derived",
          "medium",
        ),
      );
    }
  }

  if (!input.room?.trim()) {
    issues.push(issue("missing_room", "Room missing", "low"));
  }

  if (!input.modelName?.trim() && !input.tradeName?.trim()) {
    issues.push(issue("missing_model_name", "Type / model name missing", "medium"));
  }

  if (!input.serialNumber?.trim()) {
    issues.push(issue("missing_serial", "Serial number missing", "medium"));
  } else if (input.duplicateSerialInventoryNumbers.length > 0) {
    const peers = input.duplicateSerialInventoryNumbers.slice(0, 3).join(", ");
    const more =
      input.duplicateSerialInventoryNumbers.length > 3
        ? ` (+${input.duplicateSerialInventoryNumbers.length - 3})`
        : "";
    issues.push(
      issue("duplicate_serial", `Possible duplicate serial (${peers}${more})`, "high"),
    );
  }

  return issues;
}
