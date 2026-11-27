import { Suspense } from "react";
import { ScanApp } from "@/components/features/scan/ScanApp";
import { Spinner } from "@/components/ui/Loading";

/** "/" — scanner idle state and click-through workflow. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      }
    >
      <ScanApp />
    </Suspense>
  );
}
