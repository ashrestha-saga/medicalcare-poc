"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/features/shared/PageLoading";

type Job = {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  createdBy: string;
  actorKind: string;
  stats: Record<string, number> | null;
};

export default function ImportJobsPage() {
  const t = useTranslations("pages.inventoryImport");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/imports");
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-work" data-testid="import-jobs">
      <main className="p-main">
        <ListPageShell
          title={t("jobsTitle")}
          description={t("jobsEmpty")}
          headerExtra={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/devices">← {t("back")}</Link>
              </Button>
              <Button type="button" size="sm" asChild>
                <Link href="/devices/import">{t("newImport")}</Link>
              </Button>
            </div>
          }
        >
          {loading ? <PageLoading /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !error && !jobs.length ? (
            <p className="text-sm text-muted-foreground">{t("jobsEmpty")}</p>
          ) : null}
          {!loading && jobs.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Datei</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Ampel</th>
                    <th className="px-4 py-2.5 font-medium">Durch</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{j.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(j.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{j.status}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {j.stats
                          ? `${j.stats.green ?? "—"} / ${j.stats.yellow ?? "—"} / ${j.stats.red ?? "—"}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {j.createdBy}
                        <span className="text-xs"> · {j.actorKind}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
