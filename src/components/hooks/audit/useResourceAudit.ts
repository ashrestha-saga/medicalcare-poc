"use client";

import { useEffect, useState } from "react";
import type { AuditEventDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function useResourceAudit(resource: string | null, resourceId: string | null) {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("audit:view");
  const [events, setEvents] = useState<AuditEventDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView || !resource || !resourceId) {
      setEvents([]);
      return;
    }
    let alive = true;
    setLoading(true);
    void api<{ events: AuditEventDTO[] }>(
      `/api/audit/resources/${encodeURIComponent(resource)}/${encodeURIComponent(resourceId)}`,
    )
      .then((res) => {
        if (alive) setEvents(res.events);
      })
      .catch(() => {
        if (alive) setEvents([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [canView, resource, resourceId]);

  return { events, loading, canView };
}
