import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/CatalogScreen";

/** /catalog — central DeviceModel catalog (catalog:view). */
export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogScreen />
    </Suspense>
  );
}
