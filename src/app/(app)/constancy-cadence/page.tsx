import { Suspense } from "react";
import { ConstancyHubScreen } from "@/components/features/constancy/ConstancyHubScreen";

/** /constancy-cadence — Strahlenschutz: takt + routine tabs (duties:view). */
export default function ConstancyCadencePage() {
  return (
    <Suspense fallback={null}>
      <ConstancyHubScreen />
    </Suspense>
  );
}
