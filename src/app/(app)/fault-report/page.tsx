import { Suspense } from "react";
import { FaultReportScreen } from "@/components/features/repairs/FaultReportScreen";

export default function FaultReportPage() {
  return (
    <Suspense fallback={null}>
      <FaultReportScreen />
    </Suspense>
  );
}
