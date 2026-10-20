import { Suspense } from "react";
import { ReprocessingScreen } from "@/components/features/reprocessing/ReprocessingScreen";

/** /reprocessing — checks and batch release (reprocessing:view). */
export default function ReprocessingPage() {
  return (
    <Suspense fallback={null}>
      <ReprocessingScreen />
    </Suspense>
  );
}
