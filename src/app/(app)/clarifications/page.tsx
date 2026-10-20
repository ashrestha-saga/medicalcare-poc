import { Suspense } from "react";
import { ClarificationsScreen } from "@/components/features/clarifications/ClarificationsScreen";

/** /clarifications — inventory data-quality list (clarifications:view). */
export default function ClarificationsPage() {
  return (
    <Suspense fallback={null}>
      <ClarificationsScreen />
    </Suspense>
  );
}
