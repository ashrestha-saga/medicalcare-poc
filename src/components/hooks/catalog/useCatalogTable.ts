"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogModelsListApi, CatalogModelWriteDTO } from "@/interfaces";

/** Search debounce + create/import dialog orchestration for the catalog table. */
export function useCatalogTable(list: CatalogModelsListApi) {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keywordInput, setKeywordInput] = useState(list.q);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const openImport = useCallback(() => setImportOpen(true), []);

  const submitCreate = useCallback(
    async (input: CatalogModelWriteDTO) => {
      await list.create(input);
    },
    [list],
  );

  return {
    keywordInput,
    setKeyword,
    removeKeyword,
    createOpen,
    setCreateOpen,
    importOpen,
    setImportOpen,
    openCreate,
    openImport,
    submitCreate,
  };
}
