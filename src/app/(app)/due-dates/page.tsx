import { Suspense } from "react";
import { DueDatesScreen } from "@/components/features/due-dates/DueDatesScreen";

/** /due-dates — frozen duty due dates (duties:view). */
export default function DueDatesPage() {
  return (
    <Suspense fallback={null}>
      <DueDatesScreen />
    </Suspense>
  );
}
