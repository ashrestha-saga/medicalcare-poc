"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import type { DeviceInstanceDTO } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDevicesColumns } from "@/components/hooks/devices/useDevicesColumns";
import { useDevicesList } from "@/components/hooks/devices/useDevicesList";
import { useSites } from "@/components/hooks/location/useSites";
import { DevicesFilterToolbar } from "../filter-toolbar";

type ListApi = ReturnType<typeof useDevicesList>;

interface DevicesTableProps {
  list: ListApi;
  onSelect: (device: DeviceInstanceDTO) => void;
  onEdit: (device: DeviceInstanceDTO) => void;
}

export function DevicesTable({ list, onSelect, onEdit }: DevicesTableProps) {
  const sites = useSites();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState(list.q);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const setKeyword = useCallback(
    (value: string) => {
      setKeywordInput(value);
      list.setQ(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        void list.refresh(value);
      }, 280);
    },
    [list],
  );

  const removeKeyword = useCallback(() => {
    setKeywordInput("");
    list.setQ("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
    void list.refresh("");
  }, [list]);

  const columnActions = useMemo(
    () => ({
      canUpdate: list.canUpdate,
      onOpen: onSelect,
      onEdit,
    }),
    [list.canUpdate, onSelect, onEdit],
  );

  const columns = useDevicesColumns(columnActions);

  const filtered = useMemo(() => {
    if (!siteFilter) return list.devices;
    return list.devices.filter((d) => d.location?.siteId === siteFilter);
  }, [list.devices, siteFilter]);

  return (
    <div className="space-y-3 px-4 pb-4 sm:px-[18px]" data-testid="devices-list">
      <DevicesFilterToolbar
        sites={sites}
        siteFilter={siteFilter}
        onSiteChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          setSiteFilter(next);
        }}
        onClearAll={() => setSiteFilter(null)}
      />

      <DataTable
        data={filtered}
        columns={columns}
        search
        visibility
        displayPagination
        keyword={keywordInput}
        setKeyword={setKeyword}
        removeKeyword={removeKeyword}
        isLoading={list.loading}
        totalItems={filtered.length}
        getRowId={(row) => row.id}
        emptyMessage="No devices in this inventory."
        onRowClick={onSelect}
        toolbarTrailing={
          <Button type="button" size="sm" className="h-8" asChild data-testid="devices-scan">
            <Link href="/">
              <ScanLine className="h-4 w-4" />
              Scan
            </Link>
          </Button>
        }
      />
    </div>
  );
}
