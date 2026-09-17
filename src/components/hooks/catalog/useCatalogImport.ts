"use client";

import { useCallback, useRef, useState } from "react";
import type { CatalogModelImportResult } from "@/interfaces";
import { ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/** Local state for the Excel/CSV import dialog. */
export function useCatalogImport({
  onOpenChange,
  onImport,
}: {
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<CatalogModelImportResult>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CatalogModelImportResult | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const selectFile = useCallback((next: File | null) => {
    setResult(null);
    setFile(next);
  }, []);

  const runImport = useCallback(async () => {
    if (!file) {
      toast.error("Choose an Excel or CSV file first.");
      return;
    }
    setBusy(true);
    try {
      const res = await onImport(file);
      setResult(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }, [file, onImport]);

  return {
    inputRef,
    file,
    busy,
    result,
    handleOpenChange,
    selectFile,
    runImport,
  };
}
