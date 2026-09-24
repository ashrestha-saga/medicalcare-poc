"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TrainingEventDTO } from "@/interfaces";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useTrainingColumns } from "@/components/hooks/training/useTrainingColumns";

interface TrainingEventsTableProps {
  events: TrainingEventDTO[];
  loading?: boolean;
  onOpen: (id: string) => void;
}

export function TrainingEventsTable({ events, loading, onOpen }: TrainingEventsTableProps) {
  const tFilters = useTranslations("filters");
  const [keyword, setKeyword] = useState("");
  const columns = useTrainingColumns(onOpen);

  const filtered = keyword.trim()
    ? events.filter((event) => {
        const q = keyword.trim().toLowerCase();
        return [
          event.subjectModelName,
          event.subjectActivity,
          event.trainingTypeLabel,
          event.legalBasis,
          event.heldOn,
          event.instructorName,
          event.instructorQualification,
          event.location,
          event.basisDocument,
          event.statusLabel,
          event.mode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
    : events;

  return (
    <div data-testid="training-events">
      <DataTable
        data={filtered}
        columns={columns}
        search
        visibility
        displayPagination
        keyword={keyword}
        setKeyword={setKeyword}
        removeKeyword={() => setKeyword("")}
        isLoading={loading}
        totalItems={filtered.length}
        getRowId={(row) => row.id}
        emptyMessage="No training events recorded yet."
        searchPlaceholder={tFilters("searchTraining")}
        onRowClick={(row) => onOpen(row.id)}
      />
    </div>
  );
}
