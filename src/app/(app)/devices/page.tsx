import { Suspense } from "react";
import { DevicesScreen } from "@/components/features/devices/DevicesScreen";

/** /devices — tenant device inventory (inventory:view). */
export default function DevicesPage() {
  return (
    <Suspense fallback={null}>
      <DevicesScreen />
    </Suspense>
  );
}
