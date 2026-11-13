"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
  const tFilters = useTranslations("filters");
  const columns = useRequestsColumns(onSelect);
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return list.requests.filter((r) => {
      if (list.stateFilter?.length && !list.stateFilter.includes(r.state)) return false;
      if (list.quoteFilter?.length) {
        const facet = r.quote?.decision ?? "none";
        if (!list.quoteFilter.includes(facet)) return false;
      }
      if (!q) return true;
      const haystack = [
        r.reference,
        r.deviceName ?? "",
        r.inventoryNumber ?? "",
        r.subjectId,
        r.serviceType,
        r.executorOrg?.name ?? "",
        r.executorOrg?.code ?? "",
        r.state,
        r.quote?.decision ?? "",
        r.quote?.amountText ?? "",
        r.raisedBy ?? "",
        r.locationText,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [list.requests, list.stateFilter, list.quoteFilter, keyword]);

  return (
    <div className="space-y-3" data-testid="requests-list">
      <RequestsFilterToolbar
        scopes={list.scopes}
        scope={list.scope}
        onScopeChange={list.setScope}
        stateFilter={list.stateFilter}
        onStateChange={(value) =>
          list.setStateFilter(Array.isArray(value) ? value : value ? [value] : null)
        }
        quoteFilter={list.quoteFilter}
        onQuoteChange={(value) =>
          list.setQuoteFilter(Array.isArray(value) ? value : value ? [value] : null)
        }
        onClearAll={() => {
          list.setStateFilter(null);
          list.setQuoteFilter(null);
        }}
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
        searchPlaceholder={tFilters("searchRequests")}
      />
    </div>
  );
}
