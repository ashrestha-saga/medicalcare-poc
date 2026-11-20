"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSites } from "@/components/hooks/location/useSites";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";
import type { DeviceInstanceDTO } from "@/interfaces";

/** Create non-medical Betriebsmittel (E86, flag radiation_dguv). */
export function CreateEquipmentScreen() {
  const t = useTranslations("pages.equipment");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canUpdate = checkPermission("inventory:update");
  const router = useRouter();
  const sites = useSites();

  const [label, setLabel] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [modelName, setModelName] = useState("");
  const [inventoryNumber, setInventoryNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [areaId, setAreaId] = useState("");
  const [room, setRoom] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [protectionClass, setProtectionClass] = useState<"I" | "II" | "III">("I");
  const [portable, setPortable] = useState(true);
  const [electrical, setElectrical] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areas = sites.flatMap((s) =>
    (s.areas ?? []).map((a) => ({ id: a.id, label: `${s.name} · ${a.name}` })),
  );

  if (!canUpdate) {
    return (
      <AccessDenied
        title={t("title")}
        description={t("denied")}
        hint={tCommon("contactAdmin")}
        testId="equipment-create-denied"
      />
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ device: DeviceInstanceDTO }>("/api/devices/equipment", {
        method: "POST",
        body: JSON.stringify({
          label: label.trim(),
          manufacturer: manufacturer.trim() || null,
          modelName: modelName.trim() || null,
          inventoryNumber: inventoryNumber.trim() || null,
          serialNumber: serialNumber.trim() || null,
          areaId,
          room: room.trim() || null,
          responsiblePerson: responsiblePerson.trim(),
          protectionClass,
          portable,
          electrical,
        }),
      });
      toast.success(t("ok", { inv: res.device.inventoryNumber }));
      router.push(`/devices?kind=equipment&q=${encodeURIComponent(res.device.inventoryNumber)}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("errSave");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-work" data-testid="equipment-create-page">
      <ListPageShell title={t("title")} description={t("subtitle")}>
        <form className="mx-auto max-w-xl space-y-4" onSubmit={(e) => void onSubmit(e)}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="eq-label">{t("label")}</Label>
            <Input
              id="eq-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              data-testid="equipment-label"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-mfr">{t("manufacturer")}</Label>
              <Input
                id="eq-mfr"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-model">{t("modelName")}</Label>
              <Input
                id="eq-model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-inv">{t("inventoryNumber")}</Label>
              <Input
                id="eq-inv"
                value={inventoryNumber}
                onChange={(e) => setInventoryNumber(e.target.value)}
                placeholder="BM-0006"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-sn">{t("serialNumber")}</Label>
              <Input
                id="eq-sn"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-area">{t("area")}</Label>
            <select
              id="eq-area"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              required
              data-testid="equipment-area"
            >
              <option value="">{t("areaPlaceholder")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-room">{t("room")}</Label>
              <Input id="eq-room" value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-resp">{t("responsible")}</Label>
              <Input
                id="eq-resp"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-sk">{t("protectionClass")}</Label>
              <select
                id="eq-sk"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={protectionClass}
                onChange={(e) => setProtectionClass(e.target.value as "I" | "II" | "III")}
              >
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={portable}
                onChange={(e) => setPortable(e.target.checked)}
              />
              {t("portable")}
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={electrical}
                onChange={(e) => setElectrical(e.target.checked)}
              />
              {t("electrical")}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={busy || !areaId || !label.trim()} data-testid="equipment-save">
              {busy ? t("saving") : t("save")}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/devices">{tCommon("cancel")}</Link>
            </Button>
          </div>
        </form>
      </ListPageShell>
    </div>
  );
}
