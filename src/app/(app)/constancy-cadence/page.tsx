import { Suspense } from "react";
import { ConstancyCadenceScreen } from "@/components/features/constancy/ConstancyCadenceScreen";

/** /constancy-cadence — open takt / missing cadence (duties:view). */
export default function ConstancyCadencePage() {
  return (
    <Suspense fallback={null}>
      <ConstancyCadenceScreen />
    </Suspense>
  );
}
