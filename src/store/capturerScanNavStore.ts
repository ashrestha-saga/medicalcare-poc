import { create } from "zustand";
import type { ScanTabId } from "@/components/features/scan/ScanTabBar";

export type CapturerScanNavTab = { id: ScanTabId; badge?: number };

/** Desktop account-bar Scan tabs ↔ ScanApp (phone/tablet keep bottom bar). */
interface CapturerScanNavState {
  enabled: boolean;
  active: ScanTabId;
  tabs: CapturerScanNavTab[];
  setEnabled: (enabled: boolean) => void;
  setActive: (id: ScanTabId) => void;
  setTabs: (tabs: CapturerScanNavTab[]) => void;
  reset: () => void;
}

export const useCapturerScanNav = create<CapturerScanNavState>((set) => ({
  enabled: false,
  active: "scan",
  tabs: [],
  setEnabled: (enabled) => set({ enabled }),
  setActive: (active) => set({ active }),
  setTabs: (tabs) => set({ tabs }),
  reset: () => set({ enabled: false, active: "scan", tabs: [] }),
}));
