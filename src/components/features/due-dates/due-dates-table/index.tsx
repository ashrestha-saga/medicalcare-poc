"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDueDatesColumns } from "@/components/hooks/due-dates/useDueDatesColumns";
import { useDueDatesList } from "@/components/hooks/due-dates/useDueDatesList";

type ListApi = ReturnType<typeof useDueDatesList>;

export function DueDatesTable({ list }: { list: ListApi }) {
  const tFilters = useTranslations("filters");
  const [keyword, setKeyword] = useState("");
  const columns = useDueDatesColumns({
    canAssign: list.canAssign,
    assigningId: list.assigningId,
    onAssign: (id) => void list.createAssignment(id),
  });

  const filtered = keyword.trim()
    ? list.rows.filter((row) => {
        const q = keyword.trim().toLowerCase();
        return [
          row.deviceName,
          row.inventoryNumber,
          row.inspectionTypeLabel,
          row.basisText,
          row.deadlineAnchorLabel,
          row.assignment?.reference ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
    : list.rows;

  return (
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
      emptyMessage="No frozen duties with due dates yet. Release a device or reclassify a model."
      searchPlaceholder={tFilters("searchDueDates")}
    />
  );
}
