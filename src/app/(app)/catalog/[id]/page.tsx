import { CatalogScreen } from "@/components/features/catalog/CatalogScreen";

/** /catalog/[id] — DeviceModel detail (catalog:view). */
export default async function CatalogModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CatalogScreen modelId={id} />;
}
