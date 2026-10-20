"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDueDatesColumns } from "@/components/hooks/due-dates/useDueDatesColumns";
import { useDueDatesList } from "@/components/hooks/due-dates/useDueDatesList";

type ListApi = ReturnType<typeof useDueDatesList>;

export function DueDatesTable({ list }: { list: ListApi }) {
  const tFilters = useTranslations("filters");
  const [keyword, setKeywordInput] = useState(list.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columns = useDueDatesColumns({
    canAssign: list.canAssign,
    assigningId: list.assigningId,
    onAssign: (id) => void list.createAssignment(id),
  });

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

  return (
    <DataTable
      data={list.rows}
      columns={columns}
      search
      visibility
      displayPagination
      keyword={keyword}
      setKeyword={setKeyword}
      removeKeyword={removeKeyword}
      isLoading={list.loading}
      totalItems={list.rows.length}
      getRowId={(row) => row.id}
      emptyMessage="No frozen duties with due dates yet. Release a device or reclassify a model."
      searchPlaceholder={tFilters("searchDueDates")}
    />
  );
}
