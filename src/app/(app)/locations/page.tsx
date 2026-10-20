import { Suspense } from "react";
import { LocationsScreen } from "@/components/features/locations/LocationsScreen";

/** /locations — tenant clinic sites (locations:view; admin CRUD). */
export default function LocationsPage() {
  return (
    <Suspense fallback={null}>
      <LocationsScreen />
    </Suspense>
  );
}
