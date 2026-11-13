"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { QuoteDecidePanel } from "@/components/features/repairs/QuoteDecidePanel";

function QuoteDecideInner() {
  const search = useSearchParams();
  const id = search.get("id") ?? undefined;
  return (
    <div className="p-work mx-auto max-w-xl space-y-6" data-testid="quote-decide-page">
      <QuoteDecidePanel requestId={id} />
    </div>
  );
}

export default function QuoteDecidePage() {
  return (
    <Suspense fallback={null}>
      <QuoteDecideInner />
    </Suspense>
  );
}
