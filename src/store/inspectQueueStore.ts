"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface InspectQueueState {
  /** Owner of this queue — cleared when another user opens inspect. */
  userId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  references: string[];
  /** References sealed in this session. */
  doneReferences: string[];
  setQueue: (args: {
    userId: string;
    tenantId: string;
    tenantName: string | null;
    references: string[];
  }) => void;
  /** Drop references the server rejected (e.g. not assigned to this user). */
  retainReferences: (references: string[]) => void;
  markDone: (reference: string) => void;
  clear: () => void;
}

/** Hand-off from My institutions → inspection portal. Survives refresh via sessionStorage. */
export const useInspectQueueStore = create<InspectQueueState>()(
  persist(
    (set) => ({
      userId: null,
      tenantId: null,
      tenantName: null,
      references: [],
      doneReferences: [],
      setQueue: ({ userId, tenantId, tenantName, references }) =>
        set({
          userId,
          tenantId,
          tenantName,
          references: [...new Set(references)],
          doneReferences: [],
        }),
      retainReferences: (references) =>
        set((s) => ({
          references: s.references.filter((r) => references.includes(r)),
          doneReferences: s.doneReferences.filter((r) => references.includes(r)),
        })),
      markDone: (reference) =>
        set((s) => ({
          doneReferences: s.doneReferences.includes(reference)
            ? s.doneReferences
            : [...s.doneReferences, reference],
        })),
      clear: () =>
        set({
          userId: null,
          tenantId: null,
          tenantName: null,
          references: [],
          doneReferences: [],
        }),
    }),
    {
      name: "devicecare.inspectQueue",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
