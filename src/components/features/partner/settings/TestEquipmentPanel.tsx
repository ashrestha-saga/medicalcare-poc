"use client";

import { useTranslations } from "next-intl";
import { useTestEquipment } from "@/components/hooks/partner/settings/useTestEquipment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";

export function TestEquipmentPanel() {
  const t = useTranslations("pruefpartner");
  const eq = useTestEquipment();

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{t("testEquipmentTitle")}</h2>
      {eq.loading ? (
        <div className="p-wait py-6">
          <Spinner />
        </div>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {eq.items.map((item) => (
            <li key={item.id} className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
              <span className="font-medium">{item.label}</span>
              <span className="font-mono text-xs text-muted-foreground">{item.classCode}</span>
              {item.calibratedUntil ? (
                <span className="text-xs text-muted-foreground">
                  {t("testEquipmentCalibratedUntil")}: {item.calibratedUntil}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {eq.canManage ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">{t("testEquipmentClass")}</Label>
            <Input value={eq.classCode} onChange={(e) => eq.setClassCode(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("testEquipmentLabel")}</Label>
            <Input value={eq.label} onChange={(e) => eq.setLabel(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("testEquipmentSerial")}</Label>
            <Input value={eq.serialNumber} onChange={(e) => eq.setSerialNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("testEquipmentCalibratedUntil")}</Label>
            <Input
              type="date"
              value={eq.calibratedUntil}
              onChange={(e) => eq.setCalibratedUntil(e.target.value)}
            />
          </div>
          <Button type="button" disabled={eq.busy} onClick={() => void eq.addItem()}>
            {t("testEquipmentAdd")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
