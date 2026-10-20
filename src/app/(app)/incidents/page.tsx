import { Suspense } from "react";
import { IncidentsScreen } from "@/components/features/incidents/IncidentsScreen";

/** /incidents — MPAMIV incidents (incidents:view). */
export default function IncidentsPage() {
  return (
    <Suspense fallback={null}>
      <IncidentsScreen />
    </Suspense>
  );
}
