"use client";

import { ServiceTypeGatesPanel } from "@/components/features/partner/service-type-gates/ServiceTypeGatesPanel";

/** E89/A45 — standalone page wrapper for service-type gates. */
export function ServiceTypeGatesScreen() {
  return (
    <div className="p-work">
      <ServiceTypeGatesPanel variant="page" />
    </div>
  );
}
