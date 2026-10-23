"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";
import { Spinner } from "@/components/ui/Loading";
import type {
  DispatchChannelSettingsDTO,
  DispatchExecutorChannelsDTO,
  DispatchTargetsSettingsDTO,
} from "@/interfaces";

function channelTypeLabel(
  t: ReturnType<typeof useTranslations<"settings">>,
  type: string,
): string {
  if (type === "mail" || type === "webhook" || type === "oxid" || type === "erp") {
    return t(`dispatchType_${type}`);
  }
  return type;
}

export function DispatchChannelsPanel() {
  const t = useTranslations("settings");
  const { checkPermission } = usePermissions();
  const canView = checkPermission("settings:view");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [executors, setExecutors] = useState<DispatchExecutorChannelsDTO[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ dispatch: DispatchTargetsSettingsDTO }>(
        "/api/settings/dispatch-targets",
      );
      setExecutors(res.dispatch.executors);
      setCanManage(res.dispatch.canManage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("dispatchLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const toggle = async (channel: DispatchChannelSettingsDTO, enabled: boolean) => {
    if (!canManage) return;
    setBusyId(channel.id);
    const prev = channel.enabled;
    setExecutors((list) =>
      list.map((ex) => ({
        ...ex,
        channels: ex.channels.map((c) => (c.id === channel.id ? { ...c, enabled } : c)),
      })),
    );
    try {
      const res = await api<{ channel: DispatchChannelSettingsDTO }>(
        "/api/settings/dispatch-targets",
        {
          method: "PATCH",
          body: JSON.stringify({ targetId: channel.id, enabled }),
        },
      );
      setExecutors((list) =>
        list.map((ex) => ({
          ...ex,
          channels: ex.channels.map((c) => (c.id === channel.id ? res.channel : c)),
        })),
      );
      toast.success(enabled ? t("dispatchEnabled") : t("dispatchDisabled"));
    } catch (err) {
      setExecutors((list) =>
        list.map((ex) => ({
          ...ex,
          channels: ex.channels.map((c) =>
            c.id === channel.id ? { ...c, enabled: prev } : c,
          ),
        })),
      );
      toast.error(err instanceof ApiError ? err.message : t("dispatchSaveFailed"));
    } finally {
      setBusyId(null);
    }
  };

  if (!canView) return null;

  return (
    <section className="p-settings__panel" data-testid="dispatch-channels-panel">
      <p className="p-sec-title">{t("dispatchTitle")}</p>
      <p className="p-settings__intro">{t("dispatchIntro")}</p>

      {loading ? (
        <div className="p-wait p-settings__loading">
          <Spinner />
        </div>
      ) : executors.length === 0 ? (
        <p className="p-settings__hint">{t("dispatchEmpty")}</p>
      ) : (
        <div className="p-settings__dispatch" data-testid="dispatch-channels-list">
          {executors.map((ex) => (
            <div
              key={ex.id}
              className="p-settings__dispatch-group"
              data-testid={`dispatch-exec-${ex.code}`}
            >
              <div className="p-settings__dispatch-exec">
                <span className="p-settings__dispatch-exec-name">{ex.name}</span>
                <span className="p-settings__dispatch-code">{ex.code}</span>
              </div>
              <ul className="p-settings__dispatch-channels">
                {ex.channels.map((ch) => {
                  const on = ch.enabled;
                  const busy = busyId === ch.id;
                  return (
                    <li key={ch.id} className="p-settings__dispatch-row" data-on={on ? "1" : "0"}>
                      <div className="p-settings__dispatch-meta">
                        <span className="p-settings__dispatch-name">{ch.name}</span>
                        <span className="p-settings__dispatch-type">
                          {channelTypeLabel(t, ch.type)}
                          {ch.endpoint ? ` · ${ch.endpoint}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        className="p-switch"
                        aria-checked={on}
                        aria-label={t("dispatchToggleAria", { name: ch.name })}
                        disabled={!canManage || busy}
                        data-testid={`dispatch-toggle-${ch.id}`}
                        onClick={() => void toggle(ch, !on)}
                      >
                        <span className="p-switch__track" aria-hidden="true">
                          <span className="p-switch__thumb" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!canManage && !loading ? (
        <p className="p-settings__hint">{t("dispatchAskSuperadmin")}</p>
      ) : null}
    </section>
  );
}
