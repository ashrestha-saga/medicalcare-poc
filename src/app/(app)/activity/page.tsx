import { Suspense } from "react";
import { ActivityScreen } from "@/components/features/audit/ActivityScreen";

/** /activity — tenant-wide audit feed (audit:view). */
export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityScreen />
    </Suspense>
  );
}
