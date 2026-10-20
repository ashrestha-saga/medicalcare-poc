import { Suspense } from "react";
import { RequestsScreen } from "@/components/features/requests/RequestsScreen";

/** /requests — service request history, open queue, start/complete maintenance. */
export default function RequestsPage() {
  return (
    <Suspense fallback={null}>
      <RequestsScreen />
    </Suspense>
  );
}
