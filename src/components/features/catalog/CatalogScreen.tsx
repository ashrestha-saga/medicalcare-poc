"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const router = useRouter();
  const list = useCatalogModels();
  const editor = useCatalogModelEditor((model) => {
    list.applyUpdated(model);
  });

  useEffect(() => {
    if (!list.canView) return;
    if (modelId) {
      if (list.selected?.id !== modelId) void list.selectModelById(modelId);
      return;
    }
    if (list.selected) list.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → selection only
  }, [modelId, list.canView]);

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="catalog-denied">
        <main className="p-main">
          <section className="p-devhead">
            <h2>Model catalog</h2>
            <p className="p-requests__sub">You don&apos;t have permission to view the model catalog.</p>
          </section>
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
              {list.detailLoading ? "Loading model…" : "Model not found."}
            </div>
          )
        ) : (
          <div className="px-4 pb-6 pt-4 sm:px-[18px]">
            <Card className="border-border/80 bg-card/60">
              <CardHeader className="gap-4">
                <div>
                  <CardTitle className="text-2xl">Model catalog</CardTitle>
                  <CardDescription className="mt-1.5">
                    Device database · centrally maintained, across all clients
                  </CardDescription>
                </div>
                <Alert variant="warning" data-testid="catalog-warning">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Changes to the catalog affect all clients</AlertTitle>
                  <AlertDescription>
                    Classification and model master data are shared. Prefer versioned updates and confirm with affected
                    clinics before releasing safety-relevant changes.
                  </AlertDescription>
                </Alert>
              </CardHeader>
              <CardContent>
                <CatalogTable
                  list={list}
                  onSelect={(model) => openModel(model.id)}
                  onEdit={(model) => void editor.openEdit(model)}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
