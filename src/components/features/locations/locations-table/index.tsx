"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { SiteDTO } from "@/interfaces";
import { ApiError } from "@/lib/http/apiClient";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useLocationsList } from "@/components/hooks/locations/useLocationsList";
import { useLocationsColumns } from "@/components/hooks/locations/useLocationsColumns";
import { useLocationAdminForm } from "@/components/hooks/locations/useLocationAdminForm";
import { toast } from "@/store/toastStore";
import { LocationFormModal } from "../LocationFormModal";
import { DeleteLocationDialog } from "../DeleteLocationDialog";

type ListApi = ReturnType<typeof useLocationsList>;

interface LocationsTableProps {
  list: ListApi;
}

export function LocationsTable({ list }: LocationsTableProps) {
  const form = useLocationAdminForm(() => void list.refresh());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keywordInput, setKeywordInput] = useState(list.q);
  const [pendingDelete, setPendingDelete] = useState<SiteDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await list.remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }, [list, pendingDelete]);

  const columns = useLocationsColumns({
    canUpdate: list.canUpdate,
    canDelete: list.canDelete,
    onEdit: form.openEdit,
    onDelete: setPendingDelete,
  });

  const trailing = useMemo(() => {
    if (!list.canCreate) return null;
    return (
      <Button type="button" size="sm" className="h-8" onClick={form.openCreate} data-testid="locations-add">
        <Plus className="h-4 w-4" />
        Create a location
      </Button>
    );
  }, [list.canCreate, form.openCreate]);

  return (
    <>
      <div className="space-y-3 px-4 pb-4 sm:px-[18px]" data-testid="locations-list">
        <DataTable
          data={list.sites}
          columns={columns}
          search
          visibility
          displayPagination
          keyword={keywordInput}
          setKeyword={setKeyword}
          removeKeyword={removeKeyword}
          isLoading={list.loading}
          totalItems={list.sites.length}
          getRowId={(row) => row.id}
          emptyMessage="No locations yet."
          searchPlaceholder="Designation, identifier, address…"
          toolbarTrailing={trailing}
        />
      </div>

      <LocationFormModal form={form} />
      <DeleteLocationDialog
        site={pendingDelete}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
