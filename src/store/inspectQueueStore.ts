"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface InspectQueueState {
  tenantId: string | null;
  tenantName: string | null;
  references: string[];
  /** References sealed in this session. */
  doneReferences: string[];
  setQueue: (args: { tenantId: string; tenantName: string | null; references: string[] }) => void;
  markDone: (reference: string) => void;
  clear: () => void;
}

/** Hand-off from My institutions → inspection portal. Survives refresh via sessionStorage. */
export const useInspectQueueStore = create<InspectQueueState>()(
  persist(
    (set) => ({
      tenantId: null,
      tenantName: null,
      references: [],
      doneReferences: [],
      setQueue: ({ tenantId, tenantName, references }) =>
        set({
          tenantId,
          tenantName,
          references: [...new Set(references)],
          doneReferences: [],
        }),
      markDone: (reference) =>
        set((s) => ({
          doneReferences: s.doneReferences.includes(reference)
            ? s.doneReferences
            : [...s.doneReferences, reference],
        })),
      clear: () =>
        set({ tenantId: null, tenantName: null, references: [], doneReferences: [] }),
    }),
    {
      name: "devicecare.inspectQueue",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
