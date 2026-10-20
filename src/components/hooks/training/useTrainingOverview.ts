"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainingEventDTO, TrainingOverviewDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";

export type TrainingView = "overview" | "matrix" | "detail" | "record";

export function useTrainingOverview() {
  const { sync } = useSyncQueryParams();
  const mineParam = useQueryParam("mine");
  const expiringParam = useQueryParam("expiring");
  const mine = mineParam === "1" || mineParam === "true";
  const expiringDays = expiringParam && Number(expiringParam) > 0 ? Number(expiringParam) : null;

  const [data, setData] = useState<TrainingOverviewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<TrainingView>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError(null);
    try {
      const overview = await api<TrainingOverviewDTO>("/api/training");
      setData(overview);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load training");
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedEvent = useMemo(
    () => data?.events.find((e) => e.id === selectedId) ?? null,
    [data, selectedId],
  );

  const matrixModels = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    for (const cell of data.matrix) {
      if (!seen.has(cell.modelId)) seen.set(cell.modelId, cell.modelName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [data]);

  const matrixPeople = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, { name: string; jobTitle: string | null }>();
    for (const cell of data.matrix) {
      if (!seen.has(cell.personId)) {
        seen.set(cell.personId, { name: cell.personName, jobTitle: cell.personJobTitle });
      }
    }
    return [...seen.entries()].map(([id, meta]) => ({ id, ...meta }));
  }, [data]);

  const cellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cell of data?.matrix ?? []) {
      map.set(`${cell.personId}:${cell.modelId}`, cell.status);
    }
    return map;
  }, [data]);

  const goOverview = useCallback(() => {
    setView("overview");
    setSelectedId(null);
  }, []);

  const openEvent = useCallback((id: string) => {
    setSelectedId(id);
    setView("detail");
  }, []);

  const openMatrix = useCallback(() => setView("matrix"), []);
  const openRecord = useCallback(() => setView("record"), []);

  const onCreated = useCallback(
    async (eventId: string) => {
      await refresh({ quiet: true });
      setSelectedId(eventId);
      setView("detail");
    },
    [refresh],
  );

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    const horizonMs = expiringDays != null ? expiringDays * 86400000 : null;
    const now = Date.now();
    return data.events.filter((event) => {
      if (mine && !event.records.some((r) => r.personId === data.viewerPersonId)) return false;
      if (horizonMs != null) {
        const expiring = event.records.some((r) => {
          if (!r.validUntil) return false;
          const until = new Date(r.validUntil).getTime();
          return until <= now + horizonMs;
        });
        if (!expiring && event.statusKind !== "overdue") return false;
      }
      return true;
    });
  }, [data, mine, expiringDays]);

  const setMine = useCallback(
    (next: boolean) => {
      sync({ mine: next ? "1" : null });
    },
    [sync],
  );

  const setExpiring = useCallback(
    (days: number | null) => {
      sync({ expiring: days == null ? null : String(days) });
    },
    [sync],
  );

  return {
    data,
    error,
    loading,
    view,
    selectedEvent,
    matrixModels,
    matrixPeople,
    cellMap,
    filteredEvents,
    mine,
    setMine,
    expiringDays,
    setExpiring,
    goOverview,
    openEvent,
    openMatrix,
    openRecord,
    onCreated,
  };
}

export function eventTitle(event: TrainingEventDTO): string {
  return event.subjectModelName || event.subjectActivity || event.trainingTypeLabel;
}
