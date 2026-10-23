import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";

export type SperrLageCode = "ok" | "stop" | "warn";
export type SperrQuelle = "stoerung" | "routine" | "konstanz" | "rueckruf" | null;

export type ScanActionCtx =
  | "stoerung"
  | "service"
  | "routine"
  | "charge"
  | "charge-neu"
  | "konstanz"
  | "anfragen"
  | "ersatz"
  | "info"
  | "ifu";

export type ScanPrimaryAction = {
  ctx: ScanActionCtx;
  titleKey: string;
  textKey: string;
  tone: "ok" | "warn" | "stop";
  /** Prefill service type when ctx === service */
  servicePrefill?: "reparatur";
  infoOnly?: boolean;
  batchId?: string;
};

export type ScanFurtherAction = {
  ctx: ScanActionCtx;
  titleKey: string;
  textKey: string;
  batchId?: string;
  /** Optional param for i18n (e.g. IFU file name). */
  ref?: string;
};

export type DeviceActionInput = {
  state: "draft" | "review" | "released" | "retired";
  /** Aufbereitungsgerät (product kind or istAufbGeraet + eigenTyp). */
  isEquipment: boolean;
  openBatchCount: number;
  openDailyChecks: boolean;
  /** Due/overdue/failed constancy duties on this device. */
  openKonstanzChecks: boolean;
  /** Device has any applicable konstanz duty (for further actions). */
  hasKonstanzDuties: boolean;
  /** Gebrauchsanweisung label (§ 4), when evidence exists. */
  ifuLabel: string | null;
  ifuOpenUrl?: string | null;
  /** Derived Sperrlage */
  lage: SperrLageCode;
  quelle: SperrQuelle;
  grund: string | null;
  /** Open service requests on this device */
  openRequestRef: string | null;
  permissions: readonly PermissionSlug[];
  role: UserRole | null;
};

const OUT_OF_SERVICE_MARKERS = [/außer betrieb/i, /ausser betrieb/i, /out of service/i];

/** Encode out-of-service in book consequence (no schema field for ausser). */
export function encodeOutOfServiceConsequence(folge: string | null | undefined, outOfService: boolean): string | null {
  const note = folge?.trim() || "";
  if (outOfService) {
    return note ? `Außer Betrieb genommen. ${note}` : "Außer Betrieb genommen.";
  }
  return note || null;
}

export function consequenceMeansOutOfService(consequence: string | null | undefined): boolean {
  if (!consequence) return false;
  return OUT_OF_SERVICE_MARKERS.some((re) => re.test(consequence));
}

export function resolvePrimaryAction(input: DeviceActionInput): ScanPrimaryAction {
  const canReproc = input.permissions.includes("reprocessing:view");
  const canRelease = input.permissions.includes("reprocessing:release");
  const isAdmin = input.role === "device_admin" || input.role === "superadmin";
  const canKonstanz = input.permissions.includes("inventory:view");

  // Patient safety: open recall measure outranks routine / charge work.
  if (input.lage === "stop" && input.quelle === "rueckruf") {
    return {
      ctx: "info",
      titleKey: "actions.recallStop",
      textKey: "actions.recallStopHint",
      tone: "stop",
      infoOnly: true,
    };
  }

  if ((canReproc || isAdmin) && input.isEquipment && input.openDailyChecks) {
    return {
      ctx: "routine",
      titleKey: "actions.routine",
      textKey: "actions.routineHint",
      tone: "warn",
    };
  }
  if (canKonstanz && (input.openKonstanzChecks || (input.lage !== "ok" && input.quelle === "konstanz"))) {
    return {
      ctx: "konstanz",
      titleKey: "actions.konstanz",
      textKey:
        input.lage === "stop" && input.quelle === "konstanz"
          ? "actions.konstanzFailedHint"
          : "actions.konstanzHint",
      tone: input.lage === "stop" && input.quelle === "konstanz" ? "stop" : "warn",
    };
  }
  if ((canReproc || isAdmin) && input.isEquipment && input.openBatchCount > 0 && canRelease) {
    return {
      ctx: "charge",
      titleKey: "actions.chargeRelease",
      textKey: "actions.chargeReleaseHint",
      tone: "warn",
    };
  }
  if (input.lage === "stop" && input.quelle === "stoerung" && input.openRequestRef) {
    return {
      ctx: "anfragen",
      titleKey: "actions.requestOpen",
      textKey: "actions.requestOpenHint",
      tone: "warn",
    };
  }
  if (input.lage === "stop" && input.quelle === "stoerung") {
    return {
      ctx: "service",
      titleKey: "actions.service",
      textKey: "actions.serviceHint",
      tone: "stop",
      servicePrefill: "reparatur",
    };
  }
  if (input.lage === "warn" && input.quelle !== "konstanz") {
    return {
      ctx: "info",
      titleKey: "actions.notice",
      textKey: "actions.noticeHint",
      tone: "warn",
      infoOnly: true,
    };
  }
  if (
    (canReproc || isAdmin) &&
    input.isEquipment &&
    input.openBatchCount === 0 &&
    !input.openDailyChecks
  ) {
    return {
      ctx: "charge-neu",
      titleKey: "actions.chargeNew",
      textKey: "actions.chargeNewHint",
      tone: "ok",
    };
  }
  return {
    ctx: "stoerung",
    titleKey: "actions.stoerung",
    textKey: "actions.stoerungHint",
    tone: "ok",
  };
}

/**
 * MORE list — mockup-aligned: always offer actions the user may use for this
 * device type, including “done today” rows when NOW is already charge-neu.
 */
export function resolveFurtherActions(
  input: DeviceActionInput,
  primary: ScanPrimaryAction,
): ScanFurtherAction[] {
  const canBook = input.permissions.includes("devicebook:view");
  const canService = input.permissions.includes("requests:create");
  const canParts = input.permissions.includes("parts:request");
  const canReproc = input.permissions.includes("reprocessing:view");
  const isAdmin = input.role === "device_admin" || input.role === "superadmin";
  const out: ScanFurtherAction[] = [];

  if (canBook && primary.ctx !== "stoerung") {
    out.push({ ctx: "stoerung", titleKey: "actions.stoerung", textKey: "actions.stoerungHint" });
  }
  if (canService && primary.ctx !== "service" && primary.ctx !== "anfragen") {
    out.push({
      ctx: "service",
      titleKey: "actions.service",
      textKey: input.openRequestRef ? "actions.serviceOpenHint" : "actions.serviceGenericHint",
    });
  }
  if (canParts) {
    out.push({ ctx: "ersatz", titleKey: "actions.parts", textKey: "actions.partsHint" });
  }
  if (input.isEquipment && (canReproc || isAdmin)) {
    if (primary.ctx !== "routine") {
      out.push({
        ctx: "routine",
        titleKey: "actions.routine",
        textKey: input.openDailyChecks ? "actions.routineHint" : "actions.routineDoneHint",
      });
    }
    // Keep Batches in MORE even when NOW is “Neue Charge”.
    if (primary.ctx !== "charge") {
      out.push({
        ctx: "charge",
        titleKey: "actions.batches",
        textKey:
          input.openBatchCount > 0
            ? "actions.chargeReleaseHint"
            : primary.ctx === "charge-neu"
              ? "actions.batchesDoneHint"
              : "actions.batchesDoneHint",
      });
    }
  }
  if (input.hasKonstanzDuties && primary.ctx !== "konstanz") {
    out.push({
      ctx: "konstanz",
      titleKey: "actions.konstanz",
      textKey: input.openKonstanzChecks ? "actions.konstanzHint" : "actions.konstanzDoneHint",
    });
  }
  out.push({
    ctx: "ifu",
    titleKey: "actions.ifu",
    textKey: input.ifuLabel || input.ifuOpenUrl ? "actions.ifuHint" : "actions.ifuMissing",
    ref: input.ifuLabel ?? undefined,
  });
  return out;
}
