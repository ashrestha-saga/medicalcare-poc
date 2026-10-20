import { Suspense } from "react";
import { TrainingScreen } from "@/components/features/training/TrainingScreen";

/** /training — clinic staff instruction events + person×model matrix (training:view). */
export default function TrainingPage() {
  return (
    <Suspense fallback={null}>
      <TrainingScreen />
    </Suspense>
  );
}
