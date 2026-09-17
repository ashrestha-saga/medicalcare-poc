"use client";

import type { ClassificationProposalDTO } from "@/interfaces";
import { proposalSuggestedCodes, useRequestStore } from "@/store/requestStore";

/**
 * Classification proposal selection / confirm wiring for the service-request form.
 */
export function useClassification(proposal: ClassificationProposalDTO | null | undefined) {
  const selected = useRequestStore((s) => s.form.selectedTypes);
  const confirmed = useRequestStore((s) => s.form.proposalConfirmed);
  const patch = useRequestStore((s) => s.patch);
  const suggested = proposalSuggestedCodes(proposal);
  const overridden = proposal
    ? suggested.some((c) => !selected.includes(c)) || selected.some((c) => !suggested.includes(c))
    : false;
  const confKey = proposal?.confidence === "verified" ? "v" : "d";
  const value = selected[0] ?? "";

  const setType = (code: string) => {
    patch({
      selectedTypes: code ? [code] : [],
      serviceType: code || null,
    });
  };

  return { selected, confirmed, patch, suggested, overridden, confKey, value, setType };
}
