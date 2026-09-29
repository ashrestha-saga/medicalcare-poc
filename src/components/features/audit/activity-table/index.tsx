"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { ActivityFilterToolbar } from "@/components/features/audit/filter-toolbar";
import { useAuditColumns } from "@/components/hooks/audit/useAuditColumns";
import { useAuditList } from "@/components/hooks/audit/useAuditList";
import { Button } from "@/components/ui/button";

type ListApi = ReturnType<typeof useAuditList>;

export function ActivityTable({ list }: { list: ListApi }) {
  const t = useTranslations("pages.activity");
  const tFilters = useTranslations("filters");
  const columns = useAuditColumns();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeywordState] = useState("");
  const [resourceFilter, setResourceFilter] = useState<string[] | null>(null);
  const [actorKindFilter, setActorKindFilter] = useState<string[] | null>(null);

  const setKeyword = useCallback((value: string) => {
    setKeywordInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setKeywordState(value.trim()), 280);
  }, []);

  const removeKeyword = useCallback(() => {
    setKeywordInput("");
    setKeywordState("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const filtered = useMemo(() => {
    const needle = keyword.toLowerCase();
    return list.events.filter((e) => {
      if (resourceFilter?.length && !resourceFilter.includes(e.resource)) return false;
      if (actorKindFilter?.length && !actorKindFilter.includes(e.actorKind)) return false;
      if (!needle) return true;
      return [
        e.summary,
        e.actorName,
        e.actorRole,
        e.organisationName,
        e.resource,
        e.resourceId,
        e.action,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [list.events, resourceFilter, actorKindFilter, keyword]);

  return (
    <div className="space-y-3" data-testid="activity-list">
      <ActivityFilterToolbar
        resourceFilter={resourceFilter}
        actorKindFilter={actorKindFilter}
        onResourceChange={(value) =>
          setResourceFilter(Array.isArray(value) ? value : value ? [value] : null)
        }
        onActorKindChange={(value) =>
          setActorKindFilter(Array.isArray(value) ? value : value ? [value] : null)
        }
        onClearAll={() => {
          setResourceFilter(null);
          setActorKindFilter(null);
        }}
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
        emptyMessage={t("empty")}
        searchPlaceholder={tFilters("searchActivity")}
        toolbarTrailing={
          list.canExport ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void list.exportCsv()}
              data-testid="audit-export"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null
        }
      />
    </div>
  );
}
