"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  InventoryScanExtraAction,
  ScanChargeDetailDTO,
  ScanChargeListItemDTO,
  ScanChargeReleaseResultDTO,
  ScanDeviceCardDTO,
  ScanHeuteDTO,
  ScanKonstanzResultDTO,
  ScanRoutineResultDTO,
  ScanStoerungResultDTO,
} from "@/interfaces";
import { useScanStore } from "@/store/scanStore";
import { CameraPane } from "@/components/features/scan/CameraPane";
import { CapturerInventoryPanel } from "@/components/features/scan/CapturerInventoryPanel";
import { ChargeFreigabeForm } from "@/components/features/scan/ChargeFreigabeForm";
import { ChargeNeuForm } from "@/components/features/scan/ChargeNeuForm";
import { ChargenScreen } from "@/components/features/scan/ChargenScreen";
import { HeuteScreen } from "@/components/features/scan/HeuteScreen";
import { KonstanzForm } from "@/components/features/scan/KonstanzForm";
import { ScanCameraFlow } from "@/components/features/scan/ScanCameraFlow";
import { ScanConfirmScreen } from "@/components/features/scan/ScanConfirmScreen";
import { ScanDeviceCard } from "@/components/features/scan/ScanDeviceCard";
import { ScanTabBar, type ScanTabId } from "@/components/features/scan/ScanTabBar";
import { StoerungForm } from "@/components/features/scan/StoerungForm";
import { TageskontrolleForm } from "@/components/features/scan/TageskontrolleForm";
import { useFormFactor } from "@/components/layout/AuthenticatedShell";
import { useResolve } from "@/components/hooks/scan/useResolve";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import { useCapturerScanNav } from "@/store/capturerScanNavStore";
import { toast } from "@/store/toastStore";
import { useTranslations } from "next-intl";

type OverlayBack = "card" | "flow";

type Overlay =
  | { kind: "device"; deviceId: string }
  | {
      kind: "stoerung";
      deviceId: string;
      inventoryNumber: string;
      label: string;
      back: OverlayBack;
    }
  | { kind: "routine"; deviceId: string; back: OverlayBack }
  | { kind: "konstanz"; deviceId: string; back: OverlayBack }
  | {
      kind: "charge-neu";
      deviceId: string;
      inventoryNumber: string;
      label: string;
      back: OverlayBack;
    }
  | { kind: "charge-freigabe"; batchId: string; deviceId: string; back: OverlayBack }
  | {
      kind: "confirm";
      deviceId: string;
      title: string;
      lines: { label: string; value: string }[];
      hint: string | null;
      back: OverlayBack;
    };

/**
 * Scan v3 shell inside (app)/.
 * Capturers (no shell:nav) get bottom tabs: Scan · Heute · Bestand · Chargen.
 * Admins with nav keep the camera workflow on `/` unchanged.
 */
export function ScanApp() {
  const form = useFormFactor();
  const phase = useScanStore((s) => s.phase);
  const resolution = useScanStore((s) => s.resolution);
  const { checkPermission } = usePermissions();
  const isCapturer = !checkPermission("shell:nav") && checkPermission("inventory:view");
  const canReprocessing = checkPermission("reprocessing:view");
  const canStoerung = checkPermission("devicebook:view");
  const inventoryOpen = useCapturerInventoryUi((s) => s.open);
  const closeInventory = useCapturerInventoryUi((s) => s.closePanel);
  const openInventory = useCapturerInventoryUi((s) => s.openPanel);
  const inventoryCount = useCapturerInventoryUi((s) => s.count);
  const navActive = useCapturerScanNav((s) => s.active);
  const setNavEnabled = useCapturerScanNav((s) => s.setEnabled);
  const setNavActive = useCapturerScanNav((s) => s.setActive);
  const setNavTabs = useCapturerScanNav((s) => s.setTabs);
  const resetNav = useCapturerScanNav((s) => s.reset);
  const showPersistentCamera = form !== "phone";
  const { resolve } = useResolve();
  const tStoerung = useTranslations("scan.stoerung");
  const tRoutine = useTranslations("scan.routine");
  const tKonstanz = useTranslations("scan.konstanz");
  const tCharge = useTranslations("scan.charge");
  const tConfirm = useTranslations("scan.confirm");
  const tDevice = useTranslations("scan.device");

  const [tab, setTab] = useState<ScanTabId>("scan");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [heuteRemaining, setHeuteRemaining] = useState(0);

  const tabs = useMemo(() => {
    const list: { id: ScanTabId; badge?: number }[] = [
      { id: "scan" },
      { id: "heute", badge: heuteRemaining || undefined },
      { id: "bestand", badge: inventoryCount || undefined },
    ];
    if (canReprocessing) list.push({ id: "chargen" });
    return list;
  }, [canReprocessing, inventoryCount, heuteRemaining]);

  /** Bottom tabs: phone/tablet. Top account-bar pills: desktop. */
  const showBottomTabs = form === "phone" || form === "tablet";
  const showTopTabs = form === "full" && isCapturer;

  useEffect(() => {
    if (!isCapturer) {
      resetNav();
      return;
    }
    setNavEnabled(true);
    return () => resetNav();
  }, [isCapturer, setNavEnabled, resetNav]);

  useEffect(() => {
    if (!isCapturer) return;
    setNavTabs(tabs);
  }, [isCapturer, tabs, setNavTabs]);

  /** Badge: Heute items still needing action (not band “done”). */
  useEffect(() => {
    if (!isCapturer) {
      setHeuteRemaining(0);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const res = await api<ScanHeuteDTO>("/api/scan/heute");
        if (!alive) return;
        setHeuteRemaining(res.items.filter((i) => i.band !== "done").length);
      } catch {
        if (alive) setHeuteRemaining(0);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [isCapturer, tab]);

  useEffect(() => {
    if (!isCapturer) return;
    setNavActive(tab);
  }, [isCapturer, tab, setNavActive]);

  // Desktop account-bar tab click → local tab.
  useEffect(() => {
    if (!showTopTabs) return;
    if (navActive === tab) return;
    setOverlay(null);
    if (navActive !== "bestand") closeInventory();
    else openInventory();
    setTab(navActive);
  }, [showTopTabs, navActive, tab, closeInventory, openInventory]);

  useEffect(() => {
    if (!isCapturer) return;
    if (inventoryOpen) setTab("bestand");
  }, [inventoryOpen, isCapturer]);

  const onTabChange = (id: ScanTabId) => {
    if (id !== "bestand") closeInventory();
    else openInventory();
    setOverlay(null);
    setTab(id);
    setNavActive(id);
  };

  const backFromOverlay = (back: OverlayBack, deviceId: string) => {
    if (back === "flow") {
      setOverlay(null);
      return;
    }
    setOverlay({ kind: "device", deviceId });
  };

  const openService = async (card: ScanDeviceCardDTO) => {
    setOverlay(null);
    onTabChange("scan");
    await resolve(card.inventoryNumber, "manual");
  };

  const openParts = async (card: ScanDeviceCardDTO) => {
    setOverlay(null);
    onTabChange("scan");
    await resolve(card.inventoryNumber, "manual");
  };

  const onStoerungSaved = (result: ScanStoerungResultDTO, deviceId: string, back: OverlayBack) => {
    setOverlay({
      kind: "confirm",
      deviceId,
      back,
      title: result.incidentId ? tStoerung("okIncident") : tStoerung("okBook"),
      lines: [
        { label: tConfirm("kind"), value: tStoerung(`kindLabel.${result.kind}`) },
        { label: tConfirm("device"), value: result.inventoryNumber },
        {
          label: tConfirm("harm"),
          value: tStoerung(`harmLabel.${result.harm}`),
        },
        {
          label: tConfirm("status"),
          value: result.outOfService ? tStoerung("outYes") : tStoerung("outNo"),
        },
      ],
      hint: result.incidentId
        ? tStoerung("hintMpsb")
        : result.outOfService
          ? tStoerung("hintBlocked")
          : null,
    });
  };

  const onRoutineSaved = (result: ScanRoutineResultDTO, back: OverlayBack) => {
    setOverlay({
      kind: "confirm",
      deviceId: result.deviceId,
      back,
      title: result.hasMangel ? tRoutine("okMangel") : tRoutine("okOk"),
      lines: [
        ...result.lines.slice(0, 6).map((l) => ({ label: l.label, value: l.value })),
        { label: tConfirm("device"), value: result.inventoryNumber },
      ],
      hint: result.hasMangel ? tRoutine("hintMangel") : null,
    });
  };

  const onKonstanzSaved = (result: ScanKonstanzResultDTO, back: OverlayBack) => {
    setOverlay({
      kind: "confirm",
      deviceId: result.deviceId,
      back,
      title: tKonstanz(`ok.${result.result}`),
      lines: [
        { label: tKonstanz("duty"), value: result.title },
        { label: tConfirm("device"), value: result.inventoryNumber },
        { label: tKonstanz("performedAt"), value: result.performedAt },
        ...(result.nextDueAt
          ? [{ label: tKonstanz("nextDue"), value: result.nextDueAt }]
          : []),
      ],
      hint: result.result === "failed" ? tKonstanz("hintFailed") : null,
    });
  };

  const onChargeCreated = (batch: ScanChargeDetailDTO, back: OverlayBack) => {
    setOverlay({
      kind: "confirm",
      deviceId: batch.equipmentDeviceId,
      back,
      title: tCharge("okCreated"),
      lines: [
        { label: tCharge("batchNumber"), value: batch.batchNumber },
        { label: tConfirm("device"), value: batch.inventoryNumber },
        { label: tCharge("programme"), value: batch.programme ?? "—" },
      ],
      hint: tCharge("hintReleaseNext"),
    });
  };

  const onChargeReleased = (
    result: ScanChargeReleaseResultDTO,
    deviceId: string,
    back: OverlayBack,
  ) => {
    setOverlay({
      kind: "confirm",
      deviceId,
      back,
      title: tCharge(`releasedOk.${result.releaseResult}`),
      lines: [
        { label: tCharge("batchNumber"), value: result.batchNumber },
        { label: tConfirm("device"), value: result.inventoryNumber },
        { label: tCharge("signedBy"), value: result.releasedBy },
        ...(result.belegSha256
          ? [{ label: tCharge("belegSha"), value: result.belegSha256.slice(0, 16) }]
          : []),
      ],
      hint: result.releaseResult === "rejected" ? tCharge("hintRejected") : null,
    });
  };

  const openInventoryCharge = async (deviceId: string, inventoryNumber: string, label: string) => {
    if (!canReprocessing) {
      toast.error(tDevice("chargeDenied"));
      return;
    }
    try {
      const res = await api<{ items: ScanChargeListItemDTO[] }>(
        `/api/scan/chargen?equipmentDeviceId=${encodeURIComponent(deviceId)}`,
      );
      const first = res.items[0];
      if (first) {
        setOverlay({ kind: "charge-freigabe", batchId: first.id, deviceId, back: "flow" });
        return;
      }
      setOverlay({
        kind: "charge-neu",
        deviceId,
        inventoryNumber,
        label,
        back: "flow",
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : tDevice("chargeDenied"));
    }
  };

  const openInventoryIfu = async (deviceId: string) => {
    try {
      const res = await api<{ card: ScanDeviceCardDTO }>(`/api/scan/devices/${deviceId}`);
      if (res.card.ifuOpenUrl) {
        window.open(res.card.ifuOpenUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const ref = res.card.ifuLabel;
      if (ref) toast.info(tDevice("ifuOpen", { ref }));
      else toast.info(tDevice("ifuMissingToast"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : tDevice("ifuMissingToast"));
    }
  };

  const onInventoryExtraAction = (action: InventoryScanExtraAction) => {
    const device = resolution?.device;
    if (!device) return;
    const label =
      device.tradeName ?? device.modelName ?? device.manufacturer ?? device.inventoryNumber;
    switch (action) {
      case "stoerung":
        if (!canStoerung) {
          toast.error(tDevice("stoerungDenied"));
          return;
        }
        setOverlay({
          kind: "stoerung",
          deviceId: device.id,
          inventoryNumber: device.inventoryNumber,
          label,
          back: "flow",
        });
        return;
      case "routine":
        if (!canReprocessing) {
          toast.error(tDevice("routineDenied"));
          return;
        }
        setOverlay({ kind: "routine", deviceId: device.id, back: "flow" });
        return;
      case "charge":
        void openInventoryCharge(device.id, device.inventoryNumber, label);
        return;
      case "ifu":
        void openInventoryIfu(device.id);
        return;
      default:
        return;
    }
  };

  const overlayUi = (
    <>
      {overlay?.kind === "device" ? (
        <ScanDeviceCard
          deviceId={overlay.deviceId}
          canStoerung={canStoerung}
          canRoutine={canReprocessing}
          canCharge={canReprocessing}
          onBack={() => setOverlay(null)}
          onStoerung={(card) =>
            setOverlay({
              kind: "stoerung",
              deviceId: card.deviceId,
              inventoryNumber: card.inventoryNumber,
              label: card.label,
              back: "card",
            })
          }
          onRoutine={(card) =>
            setOverlay({ kind: "routine", deviceId: card.deviceId, back: "card" })
          }
          onKonstanz={(card) =>
            setOverlay({ kind: "konstanz", deviceId: card.deviceId, back: "card" })
          }
          onChargeNeu={(card) =>
            setOverlay({
              kind: "charge-neu",
              deviceId: card.deviceId,
              inventoryNumber: card.inventoryNumber,
              label: card.label,
              back: "card",
            })
          }
          onChargeFreigabe={(card, batchId) =>
            setOverlay({
              kind: "charge-freigabe",
              batchId,
              deviceId: card.deviceId,
              back: "card",
            })
          }
          onService={(card) => void openService(card)}
          onParts={(card) => void openParts(card)}
        />
      ) : null}
      {overlay?.kind === "stoerung" ? (
        <StoerungForm
          deviceId={overlay.deviceId}
          inventoryNumber={overlay.inventoryNumber}
          label={overlay.label}
          onCancel={() => backFromOverlay(overlay.back, overlay.deviceId)}
          onSaved={(result) => onStoerungSaved(result, overlay.deviceId, overlay.back)}
        />
      ) : null}
      {overlay?.kind === "routine" ? (
        <TageskontrolleForm
          deviceId={overlay.deviceId}
          onCancel={() => backFromOverlay(overlay.back, overlay.deviceId)}
          onSaved={(result) => onRoutineSaved(result, overlay.back)}
        />
      ) : null}
      {overlay?.kind === "konstanz" ? (
        <KonstanzForm
          deviceId={overlay.deviceId}
          onCancel={() => backFromOverlay(overlay.back, overlay.deviceId)}
          onSaved={(result) => onKonstanzSaved(result, overlay.back)}
        />
      ) : null}
      {overlay?.kind === "charge-neu" ? (
        <ChargeNeuForm
          deviceId={overlay.deviceId}
          inventoryNumber={overlay.inventoryNumber}
          label={overlay.label}
          onCancel={() => backFromOverlay(overlay.back, overlay.deviceId)}
          onSaved={(batch) => onChargeCreated(batch, overlay.back)}
        />
      ) : null}
      {overlay?.kind === "charge-freigabe" ? (
        <ChargeFreigabeForm
          batchId={overlay.batchId}
          onCancel={() => backFromOverlay(overlay.back, overlay.deviceId)}
          onSaved={(result) => onChargeReleased(result, overlay.deviceId, overlay.back)}
        />
      ) : null}
      {overlay?.kind === "confirm" ? (
        <ScanConfirmScreen
          title={overlay.title}
          lines={overlay.lines}
          hint={overlay.hint}
          onDevice={() => backFromOverlay(overlay.back, overlay.deviceId)}
          onHeute={() => {
            setOverlay(null);
            if (isCapturer) setTab("heute");
          }}
        />
      ) : null}
    </>
  );

  if (!isCapturer) {
    return (
      <div className="p-work" data-testid="scan-app" data-capturer="0">
        {showPersistentCamera && !overlay && (
          <aside className="p-campane">
            <CameraPane tabletHint />
          </aside>
        )}
        <main className="p-main">
          {overlayUi}
          {!overlay ? (
            <ScanCameraFlow
              showInlineCamera={!showPersistentCamera && (phase === "idle" || phase === "manual-entry")}
              onInventoryExtraAction={onInventoryExtraAction}
            />
          ) : null}
        </main>
      </div>
    );
  }

  const activeTab = tab;
  const showInlineCamera =
    !showPersistentCamera &&
    !overlay &&
    activeTab === "scan" &&
    (phase === "idle" || phase === "manual-entry");
  const showCameraPane = showPersistentCamera && activeTab === "scan" && !overlay;

  return (
    <div
      className={["p-work", showBottomTabs ? "p-work--scan-tabs" : ""].filter(Boolean).join(" ")}
      data-testid="scan-app"
      data-capturer="1"
      data-tab={activeTab}
      data-bottom-tabs={showBottomTabs ? "1" : "0"}
      data-top-tabs={showTopTabs ? "1" : "0"}
    >
      {showCameraPane && (
        <aside className="p-campane">
          <CameraPane tabletHint />
        </aside>
      )}
      <main className="p-main">
        {overlayUi}
        {!overlay && activeTab === "scan" ? (
          <ScanCameraFlow
            showInlineCamera={showInlineCamera}
            onInventoryExtraAction={onInventoryExtraAction}
          />
        ) : null}
        {!overlay && activeTab === "heute" ? (
          <HeuteScreen active onOpenDevice={(id) => setOverlay({ kind: "device", deviceId: id })} />
        ) : null}
        {!overlay && activeTab === "bestand" ? (
          <CapturerInventoryPanel
            embedded
            onCloseTab={() => onTabChange("scan")}
            onOpenDevice={(id) => setOverlay({ kind: "device", deviceId: id })}
          />
        ) : null}
        {!overlay && activeTab === "chargen" && canReprocessing ? (
          <ChargenScreen
            active
            onOpenBatch={(batchId, deviceId) =>
              setOverlay({ kind: "charge-freigabe", batchId, deviceId, back: "card" })
            }
            onNewCharge={() => {
              setOverlay(null);
              onTabChange("scan");
            }}
          />
        ) : null}
      </main>
      {showBottomTabs && !overlay ? (
        <ScanTabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
      ) : null}
    </div>
  );
}
