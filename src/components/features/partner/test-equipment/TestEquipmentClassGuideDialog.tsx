"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";
import type { TestEquipmentClassDTO } from "@/interfaces/pruefpartner";
import { TEST_EQUIPMENT_CLASS_GROUPS } from "@/constants/testEquipmentClasses";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PURPOSE_KEYS = {
  sicherheitstester: "equipmentClass_sicherheitstester_purpose",
  multimeter: "equipmentClass_multimeter_purpose",
  nibp_sim: "equipmentClass_nibp_sim_purpose",
  temp_normal: "equipmentClass_temp_normal_purpose",
  schwarzkoerper: "equipmentClass_schwarzkoerper_purpose",
  audio_kal: "equipmentClass_audio_kal_purpose",
  tonometer_pruefkoerper: "equipmentClass_tonometer_pruefkoerper_purpose",
  ergometer_normal: "equipmentClass_ergometer_normal_purpose",
  roentgen_pruefkoerper: "equipmentClass_roentgen_pruefkoerper_purpose",
  monitor_testbild: "equipmentClass_monitor_testbild_purpose",
  dosimeter_normal: "equipmentClass_dosimeter_normal_purpose",
} as const;

const USEDFOR_KEYS = {
  sicherheitstester: "equipmentClass_sicherheitstester_usedFor",
  multimeter: "equipmentClass_multimeter_usedFor",
  nibp_sim: "equipmentClass_nibp_sim_usedFor",
  temp_normal: "equipmentClass_temp_normal_usedFor",
  schwarzkoerper: "equipmentClass_schwarzkoerper_usedFor",
  audio_kal: "equipmentClass_audio_kal_usedFor",
  tonometer_pruefkoerper: "equipmentClass_tonometer_pruefkoerper_usedFor",
  ergometer_normal: "equipmentClass_ergometer_normal_usedFor",
  roentgen_pruefkoerper: "equipmentClass_roentgen_pruefkoerper_usedFor",
  monitor_testbild: "equipmentClass_monitor_testbild_usedFor",
  dosimeter_normal: "equipmentClass_dosimeter_normal_usedFor",
} as const;

type PurposeKey = (typeof PURPOSE_KEYS)[keyof typeof PURPOSE_KEYS];
type UsedForKey = (typeof USEDFOR_KEYS)[keyof typeof USEDFOR_KEYS];

function purposeKey(code: string): PurposeKey | null {
  return PURPOSE_KEYS[code as keyof typeof PURPOSE_KEYS] ?? null;
}

function usedForKey(code: string): UsedForKey | null {
  return USEDFOR_KEYS[code as keyof typeof USEDFOR_KEYS] ?? null;
}

const GROUP_LABEL_KEYS = {
  electrical: "equipmentClassGroupElectrical",
  vitals: "equipmentClassGroupVitals",
  imaging: "equipmentClassGroupImaging",
  specialty: "equipmentClassGroupSpecialty",
  general: "equipmentClassGroupGeneral",
} as const;

export function TestEquipmentClassGuideDialog({
  classes,
  highlightCode,
}: {
  classes: TestEquipmentClassDTO[];
  highlightCode?: string;
}) {
  const t = useTranslations("pruefpartner");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = classes.filter((c) => {
      if (!needle) return true;
      const pKey = purposeKey(c.code);
      const uKey = usedForKey(c.code);
      const purpose = pKey ? t(pKey) : "";
      const used = uKey ? t(uKey) : "";
      return `${c.code} ${c.label} ${purpose} ${used}`.toLowerCase().includes(needle);
    });
    return TEST_EQUIPMENT_CLASS_GROUPS.map((group) => ({
      group,
      items: filtered.filter((c) => c.group === group),
    })).filter((g) => g.items.length > 0);
  }, [classes, q, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          aria-label={t("equipmentClassGuideAria")}
          title={t("equipmentClassGuideAria")}
          data-testid="test-equipment-class-guide"
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("equipmentClassGuideTitle")}</DialogTitle>
          <DialogDescription>{t("equipmentClassGuideIntro")}</DialogDescription>
        </DialogHeader>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("equipmentClassGuideSearch")}
          className="shrink-0"
          data-testid="test-equipment-class-guide-search"
        />
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("equipmentClassGuideEmpty")}</p>
          ) : (
            grouped.map(({ group, items }) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(GROUP_LABEL_KEYS[group])}
                </h3>
                <ul className="space-y-3">
                  {items.map((c) => {
                    const pKey = purposeKey(c.code);
                    const uKey = usedForKey(c.code);
                    const highlighted = highlightCode === c.code;
                    return (
                      <li
                        key={c.code}
                        className={
                          highlighted
                            ? "rounded-md border border-foreground/25 bg-muted/40 p-3"
                            : "rounded-md border border-border/70 p-3"
                        }
                        data-testid={`equipment-class-${c.code}`}
                      >
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.code}</p>
                        {pKey ? (
                          <p className="mt-2 text-sm text-foreground/90">{t(pKey)}</p>
                        ) : null}
                        {uKey ? (
                          <p className="mt-1 text-xs text-muted-foreground">{t(uKey)}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{t("equipmentClassGuideFootnote")}</p>
      </DialogContent>
    </Dialog>
  );
}
