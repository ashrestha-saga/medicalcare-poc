"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** E81 — toggle Dienstleister import right on the live contract. */
export function ImportRightCard() {
  const t = useTranslations("pages.inventoryImport");
  const [effective, setEffective] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/settings/import-right");
      if (!res.ok) return;
      const data = await res.json();
      setEffective(Boolean(data.effective));
    } catch {
      /* optional card */
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = async () => {
    if (effective == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/import-right", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !effective }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setEffective(Boolean(data.effective));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (effective == null) return null;

  return (
    <Card className="mt-4 border-border/80" data-testid="import-right-card">
      <CardHeader>
        <CardTitle className="text-base">{t("jobsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Dienstleister darf den Bestand importieren:{" "}
          <b>{effective ? "an" : "aus"}</b>
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void toggle()}>
          {effective ? "Importrecht aus" : "Importrecht an"}
        </Button>
      </CardContent>
    </Card>
  );
}
