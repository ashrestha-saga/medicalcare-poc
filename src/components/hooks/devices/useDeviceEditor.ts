"use client";

import { useCallback, useState } from "react";
import type { DeviceInstanceDetailDTO, DeviceInstanceDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import type { UpdateDeviceInput } from "@/schemas/device";
import { toast } from "@/store/toastStore";

export function useDeviceEditor(onSaved: (device: DeviceInstanceDetailDTO) => void) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DeviceInstanceDetailDTO | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [inventoryNumber, setInventoryNumber] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [modelName, setModelName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [udiDi, setUdiDi] = useState("");
  const [purchaseYear, setPurchaseYear] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [room, setRoom] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setDetail(null);
    setFieldErrors({});
    setBusy(false);
  }, []);

  const hydrate = useCallback((device: DeviceInstanceDetailDTO) => {
    setDetail(device);
    setInventoryNumber(device.inventoryNumber);
    setTradeName(device.tradeName ?? "");
    setModelName(device.modelName ?? "");
    setManufacturer(device.manufacturer ?? "");
    setSerialNumber(device.serialNumber ?? "");
    setUdiDi(device.udiDi ?? "");
    setPurchaseYear(device.commissionedAt ? String(new Date(device.commissionedAt).getUTCFullYear()) : "");
    setResponsiblePerson(device.responsiblePerson ?? "");
    setAreaId(device.location?.areaId ?? "");
    setRoom(device.location?.room ?? "");
    setFieldErrors({});
  }, []);

  const openEdit = useCallback(
    async (device: DeviceInstanceDTO) => {
      setOpen(true);
      setLoading(true);
      try {
        const res = await api<{ device: DeviceInstanceDetailDTO }>(`/api/devices/${device.id}`);
        hydrate(res.device);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not load device.");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [hydrate],
  );

  const submit = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    setFieldErrors({});
    try {
      if (!serialNumber.trim() && !udiDi.trim()) {
        setFieldErrors({
          serialNumber: "Provide a serial number or UDI-DI.",
          udiDi: "Provide a serial number or UDI-DI.",
        });
        return;
      }
      const body: UpdateDeviceInput = {
        inventoryNumber: inventoryNumber.trim(),
        serialNumber: serialNumber.trim() || null,
        tradeName: tradeName.trim() || null,
        modelName: modelName.trim() || null,
        manufacturer: manufacturer.trim() || null,
        udiDi: udiDi.trim() || null,
        commissionedAt: purchaseYear.trim() || null,
        responsiblePerson: responsiblePerson.trim() || null,
        areaId: areaId || null,
        room: room.trim() || null,
      };
      const res = await api<{ device: DeviceInstanceDetailDTO }>(`/api/devices/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Device saved.");
      hydrate(res.device);
      onSaved(res.device);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [
    detail,
    inventoryNumber,
    serialNumber,
    tradeName,
    modelName,
    manufacturer,
    udiDi,
    purchaseYear,
    responsiblePerson,
    areaId,
    room,
    hydrate,
    onSaved,
  ]);

  return {
    open,
    busy,
    loading,
    detail,
    fieldErrors,
    inventoryNumber,
    setInventoryNumber,
    tradeName,
    setTradeName,
    modelName,
    setModelName,
    manufacturer,
    setManufacturer,
    serialNumber,
    setSerialNumber,
    udiDi,
    setUdiDi,
    purchaseYear,
    setPurchaseYear,
    responsiblePerson,
    setResponsiblePerson,
    areaId,
    setAreaId,
    room,
    setRoom,
    openEdit,
    close,
    submit,
  };
}
