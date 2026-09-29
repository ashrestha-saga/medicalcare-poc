"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface ActingTenantState {
  tenantId: string | null;
  tenantName: string | null;
  tenantCode: string | null;
  contractId: string | null;
  setActingTenant: (args: {
    tenantId: string;
    tenantName: string;
    tenantCode?: string | null;
    contractId?: string | null;
  }) => void;
  clearActingTenant: () => void;
}

/** Partner acting-tenant for clinic APIs (x-acting-tenant-id). */
export const useActingTenantStore = create<ActingTenantState>()(
  persist(
    (set) => ({
      tenantId: null,
      tenantName: null,
      tenantCode: null,
      contractId: null,
      setActingTenant: (args) =>
        set({
          tenantId: args.tenantId,
          tenantName: args.tenantName,
          tenantCode: args.tenantCode ?? null,
          contractId: args.contractId ?? null,
        }),
      clearActingTenant: () =>
        set({ tenantId: null, tenantName: null, tenantCode: null, contractId: null }),
    }),
    {
      name: "devicecare.actingTenant",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
