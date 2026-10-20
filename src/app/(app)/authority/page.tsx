import { Suspense } from "react";
import { AuthorityScreen } from "@/components/features/authority/AuthorityScreen";

/** /authority — inspections, findings, disclosure (authority:view). */
export default function AuthorityPage() {
  return (
    <Suspense fallback={null}>
      <AuthorityScreen />
    </Suspense>
  );
}
