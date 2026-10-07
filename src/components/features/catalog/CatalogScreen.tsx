"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { useCatalogModels } from "@/components/hooks/catalog/useCatalogModels";
import { useCatalogModelEditor } from "@/components/hooks/catalog/useCatalogModelEditor";
import { CatalogDetail } from "./CatalogDetail";
import { CatalogEditForm } from "./CatalogEditForm";
import { CatalogTable } from "./catalog-table";

interface CatalogScreenProps {
  /** When set (from /catalog/[id]), open that model detail. */
  modelId?: string;
}

/** Central DeviceModel catalog — list → detail → full-page edit; create stays a modal. */
export function CatalogScreen({ modelId }: CatalogScreenProps) {
  const t = useTranslations("pages.catalog");
  const tDetail = useTranslations("catalogDetail");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantEdit = searchParams.get("edit") === "1";
  const editOpenedFor = useRef<string | null>(null);
  const list = useCatalogModels();
  const editor = useCatalogModelEditor((model) => {
    list.applyUpdated(model);
    if (wantEdit && modelId) {
      router.replace(`/catalog/${modelId}`);
    }
  });
  const { open: editorOpen, openEdit } = editor;

  useEffect(() => {
    if (!list.canView) return;
    if (modelId) {
      if (list.selected?.id !== modelId) void list.selectModelById(modelId);
      return;
    }
    if (list.selected) list.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → selection only
  }, [modelId, list.canView]);

  useEffect(() => {
    if (!wantEdit || !modelId || !list.canUpdate) return;
    if (!list.selected || list.selected.id !== modelId) return;
    if (editorOpen) return;
    if (editOpenedFor.current === modelId) return;
    editOpenedFor.current = modelId;
    void openEdit(list.selected);
  }, [wantEdit, modelId, list.canUpdate, list.selected, editorOpen, openEdit]);

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="catalog-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={tCommon("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const openModel = (id: string) => {
    router.push(`/catalog/${id}`);
  };

  return (
    <div className="p-work" data-testid="catalog-page">
      <main className="p-main">
        {editor.open ? (
          <CatalogEditForm form={editor} />
        ) : modelId ? (
          list.selected && list.selected.id === modelId ? (
            <CatalogDetail
              model={list.selected}
              canEdit={list.canUpdate}
              onBack={() => router.push("/catalog")}
              onEdit={() => void editor.openEdit(list.selected!)}
            />
          ) : (
            <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground sm:px-[18px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {list.detailLoading ? tDetail("loadingModel") : tDetail("modelNotFound")}
            </div>
          )
        ) : (
          <ListPageShell
            title={t("title")}
            description={t("description")}
            headerExtra={
              <Alert variant="warning" data-testid="catalog-warning">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>{tDetail("catalogWarningTitle")}</AlertTitle>
                <AlertDescription>
                  {tDetail("catalogWarningBody")}
                </AlertDescription>
              </Alert>
            }
          >
            <CatalogTable
              list={list}
              onSelect={(model) => openModel(model.id)}
              onEdit={(model) => void editor.openEdit(model)}
            />
          </ListPageShell>
        )}
      </main>
    </div>
  );
}
