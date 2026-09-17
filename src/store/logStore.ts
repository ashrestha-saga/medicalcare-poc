"use client";

import { create } from "zustand";

/** Local activity log — dev/demo aid shown in the log panel. Never sent anywhere. */
export type LogChannel = "scan" | "resolve" | "request" | "queue" | "auth" | "error" | "info";

export interface LogEntry {
  id: number;
  at: string;
  channel: LogChannel;
  message: string;
}

interface LogState {
  entries: LogEntry[];
  log(channel: LogChannel, message: string): void;
  clear(): void;
}

let seq = 0;

export const useLogStore = create<LogState>()((set) => ({
  entries: [],
  log: (channel, message) =>
    set((s) => ({
      entries: [{ id: ++seq, at: new Date().toISOString(), channel, message }, ...s.entries].slice(0, 200),
    })),
  clear: () => set({ entries: [] }),
}));
