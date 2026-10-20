"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RowSelectionState } from "@tanstack/react-table";
import { Printer, Plus, ScanLine, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DeviceInstanceDTO } from "@/interfaces";
import { CameraScanner } from "@/components/features/scan/CameraScanner";
import { BarcodeCapture } from "@/components/features/shared/barcode-capture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { printInventoryLabels } from "@/components/features/devices/labels/printInventoryLabels";
import { toInventoryLabels } from "@/lib/inventory/label";
import { identifierLookupText, matchesDevice } from "@/lib/barcode/matchDevice";
import type { BarcodeCaptureResult } from "@/lib/barcode/types";
import { parseIdentifier } from "@/lib/gs1";
import { api, ApiError } from "@/lib/http/apiClient";
import { useDevicesColumns } from "@/components/hooks/devices/useDevicesColumns";
import { useDevicesList } from "@/components/hooks/devices/useDevicesList";
import { useSites } from "@/components/hooks/location/useSites";
import { toast } from "@/store/toastStore";
import { DevicesFilterToolbar } from "../filter-toolbar";

const DEVICE_SEARCH_KINDS = ["inventory", "serial", "unknown"] as const;

function isDeviceSearchCode(identifier: ReturnType<typeof parseIdentifier>): boolean {
  if ((DEVICE_SEARCH_KINDS as readonly string[]).includes(identifier.kind)) return true;
  // GS1 UDI with serial AI is valid for instance lookup
  return Boolean(identifier.serial?.trim());
}

type ListApi = ReturnType<typeof useDevicesList>;

interface DevicesTableProps {
  list: ListApi;
  onSelect: (device: DeviceInstanceDTO) => void;
  onEdit: (device: DeviceInstanceDTO) => void;
}

export function DevicesTable({ list, onSelect, onEdit }: DevicesTableProps) {
  const tFilters = useTranslations("filters");
  const t = useTranslations("pages.inventory");
  const sites = useSites();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keywordInput, setKeywordInput] = useState(list.q);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  useEffect(() => {
    setKeywordInput(list.q);
  }, [list.q]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const setKeyword = useCallback(
    (value: string) => {
      setKeywordInput(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        list.setQ(value);
      }, 280);
    },
    [list],
  );

  const removeKeyword = useCallback(() => {
    setKeywordInput("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
    list.setQ("");
  }, [list]);

  const printOne = useCallback((device: DeviceInstanceDTO) => {
    printInventoryLabels(toInventoryLabels([device]));
  }, []);

  const columnActions = useMemo(
    () => ({
      canUpdate: list.canUpdate,
      onOpen: onSelect,
      onEdit,
      onPrint: printOne,
    }),
    [list.canUpdate, onSelect, onEdit, printOne],
  );

  const columns = useDevicesColumns(columnActions);

  const selectedDevices = useMemo(
    () => list.devices.filter((d) => rowSelection[d.id]),
    [list.devices, rowSelection],
  );

  const printSelected = useCallback(() => {
    if (selectedDevices.length === 0) return;
    printInventoryLabels(toInventoryLabels(selectedDevices));
  }, [selectedDevices]);

  const onBarcodeSearch = useCallback(
    async (result: BarcodeCaptureResult) => {
      const token = identifierLookupText(result.identifier) || result.raw;
      if (!token || scanBusy) return;
      setScanBusy(true);
      try {
        setKeywordInput(token);
        list.setQ(token);
        const res = await api<{ devices: DeviceInstanceDTO[] }>(
          `/api/devices?q=${encodeURIComponent(token)}`,
        );
        await list.refresh({ q: token });

        const hits = res.devices.filter((d) =>
          matchesDevice(result.identifier, {
            inventoryNumber: d.inventoryNumber,
            serialNumber: d.serialNumber,
          }),
        );
        const match = hits[0] ?? (res.devices.length === 1 ? res.devices[0] : null);
        if (!match) {
          toast.error(t("scanNotFound"));
          return;
        }
        setScanOpen(false);
        toast.success(t("scanFound", { inventory: match.inventoryNumber }));
        onSelect(match);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("scanFailed"));
      } finally {
        setScanBusy(false);
      }
    },
    [list, onSelect, scanBusy, t],
  );

  return (
    <div className="space-y-3" data-testid="devices-list">
      <DevicesFilterToolbar
        sites={sites}
        siteFilter={list.siteFilter}
        onSiteChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          list.setSiteFilter(next);
        }}
        stateFilter={list.stateFilter}
        onStateChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          list.setStateFilter(
            next === "draft" ||
              next === "review" ||
              next === "released" ||
              next === "retired" ||
              next === "not_released"
              ? next
              : null,
          );
        }}
        mineArea={list.mineArea}
        onMineAreaChange={list.setMineArea}
        onClearAll={() => list.clearListFilters()}
      />

      <DataTable
        data={list.devices}
        columns={columns}
        search
        visibility
        displayPagination
        keyword={keywordInput}
        setKeyword={setKeyword}
        removeKeyword={removeKeyword}
        isLoading={list.loading}
        totalItems={list.devices.length}
        getRowId={(row) => row.id}
        emptyMessage="No devices in this inventory."
        searchPlaceholder={tFilters("searchDevices")}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        toolbarTrailing={
          <div className="flex flex-wrap items-center gap-2">
            {selectedDevices.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={printSelected}
                data-testid="devices-print-bulk"
              >
                <Printer className="h-4 w-4" />
                Print labels ({selectedDevices.length})
              </Button>
            )}
            {list.canUpdate && (
              <Button type="button" size="sm" variant="outline" className="h-8" asChild data-testid="devices-erstanlage">
                <Link href="/registration">
                  <Plus className="h-4 w-4" />
                  Registration
                </Link>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => setScanOpen(true)}
              data-testid="devices-barcode-search"
            >
              <Search className="h-4 w-4" />
              {t("searchScan")}
            </Button>
            <Button type="button" size="sm" className="h-8" asChild data-testid="devices-request-service">
              <Link href="/">
                <ScanLine className="h-4 w-4" />
                {t("requestService")}
              </Link>
            </Button>
          </div>
        }
      />

      <Dialog open={scanOpen} onOpenChange={(open) => !scanBusy && setScanOpen(open)}>
        <DialogContent className="max-w-md" data-testid="devices-barcode-search-dialog">
          <DialogHeader>
            <DialogTitle>{t("searchScanTitle")}</DialogTitle>
            <DialogDescription>{t("searchScanHint")}</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-[240px] overflow-hidden rounded-lg border border-border bg-black">
            <CameraScanner
              active={scanOpen && !scanBusy}
              onScan={(raw) => {
                const identifier = parseIdentifier(raw);
                if (!isDeviceSearchCode(identifier)) {
                  toast.error(t("searchScanWrongKind"));
                  return;
                }
                void onBarcodeSearch({ raw, origin: "camera", identifier });
              }}
            />
          </div>
          <BarcodeCapture
            data-testid="devices-barcode-capture"
            showCamera={false}
            busy={scanBusy}
            allowedKinds={[...DEVICE_SEARCH_KINDS]}
            placeholder={t("searchScanPlaceholder")}
            submitLabel={t("searchScanApply")}
            onCapture={onBarcodeSearch}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
