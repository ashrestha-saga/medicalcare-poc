import { Suspense } from "react";
import { ExternalRepairScreen } from "@/components/features/repairs/ExternalRepairScreen";

export default function ExternalRepairPage() {
  return (
    <Suspense fallback={null}>
      <ExternalRepairScreen />
    </Suspense>
  );
}
