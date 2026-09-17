"use client";

import { useEffect, useState } from "react";
import type { SiteDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";

let cache: SiteDTO[] | null = null;
let inflight: Promise<SiteDTO[]> | null = null;

async function loadSites(): Promise<SiteDTO[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = api<{ sites: SiteDTO[] }>("/api/sites")
      .then((r) => {
        cache = r.sites;
        return r.sites;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateSites() {
  cache = null;
}

/** Tenant sites + areas, fetched once per session. */
export function useSites(): SiteDTO[] {
  const [sites, setSites] = useState<SiteDTO[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    loadSites()
      .then((s) => alive && setSites(s))
      .catch(() => alive && setSites([]));
    return () => {
      alive = false;
    };
  }, []);
  return sites;
}
