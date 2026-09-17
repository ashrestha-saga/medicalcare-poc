"use client";

import { useMemo, useState } from "react";
import type { ServiceRequestDTO } from "@/interfaces";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useRequestsColumns } from "@/components/hooks/requests/useRequestsColumns";
import { useRequestsList } from "@/components/hooks/requests";
import { RequestsFilterToolbar } from "../filter-toolbar";

type ListApi = ReturnType<typeof useRequestsList>;

interface RequestsTableProps {
  list: ListApi;
  onSelect: (request: ServiceRequestDTO) => void;
}

export function RequestsTable({ list, onSelect }: RequestsTableProps) {
  const columns = useRequestsColumns(onSelect);
  const [stateFilter, setStateFilter] = useState<string[] | null>(null);
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return list.requests.filter((r) => {
      if (stateFilter?.length && !stateFilter.includes(r.state)) return false;
      if (!q) return true;
      const haystack = [
        r.reference,
        r.serviceType,
        r.priority ?? "",
        r.state,
        r.raisedBy ?? "",
        r.locationText,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [list.requests, stateFilter, keyword]);

  return (
    <div className="space-y-3 px-4 pb-4 sm:px-[18px]" data-testid="requests-list">
      <RequestsFilterToolbar
        scopes={list.scopes}
        scope={list.scope}
        onScopeChange={list.setScope}
        stateFilter={stateFilter}
        onStateChange={(value) => setStateFilter(Array.isArray(value) ? value : value ? [value] : null)}
        onClearAll={() => setStateFilter(null)}
      />

      <DataTable
        data={filtered}
        columns={columns}
        search
        visibility
        displayPagination
        keyword={keyword}
        setKeyword={setKeyword}
        removeKeyword={() => setKeyword("")}
        isLoading={list.loading}
        totalItems={filtered.length}
        getRowId={(row) => row.id}
        emptyMessage="No requests in this view."
        onRowClick={onSelect}
      />
    </div>
  );
}
