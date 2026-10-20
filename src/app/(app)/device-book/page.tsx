import { Suspense } from "react";
import { DeviceBookScreen } from "@/components/features/device-book/DeviceBookScreen";

/** /device-book — § 13 medical device book (devicebook:view). */
export default function DeviceBookPage() {
  return (
    <Suspense fallback={null}>
      <DeviceBookScreen />
    </Suspense>
  );
}
