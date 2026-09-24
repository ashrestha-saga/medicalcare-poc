import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/CatalogScreen";

/** /catalog/[id] — DeviceModel detail (catalog:view); ?edit=1 opens admin edit. */
export default async function CatalogModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <CatalogScreen modelId={id} />
    </Suspense>
  );
}
