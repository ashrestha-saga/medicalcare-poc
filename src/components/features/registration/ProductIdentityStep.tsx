"use client";

import { useTranslations } from "next-intl";
import type { SiteDTO, UserRole } from "@/interfaces";
import type { RegistrationWizardApi } from "@/components/hooks/registration/useRegistrationWizard";
import { useUserOptions } from "@/components/hooks/users/useUserOptions";

const DEVICE_ADMIN_ROLES: UserRole[] = ["device_admin"];

export function ProductIdentityStep({
  form,
  patchForm,
  sites,
  areas,
  fieldErrors,
  busy,
  onContinue,
}: {
  form: RegistrationWizardApi["form"];
  patchForm: RegistrationWizardApi["patchForm"];
  sites: SiteDTO[];
  areas: SiteDTO["areas"];
  fieldErrors: Record<string, string>;
  busy: boolean;
  onContinue: () => void;
}) {
  const t = useTranslations("registration");
  const tCommon = useTranslations("common");
  const err = (key: string) => fieldErrors[key];
  const { users, loading: usersLoading } = useUserOptions({
    roles: DEVICE_ADMIN_ROLES,
    active: true,
  });

  return (
    <section className="p-reg__step-body" data-testid="registration-step-identity">
      <div className="p-reg__card">
        <h3 className="p-reg__section">{t("identityTitle")}</h3>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="tradeName">{t("name")}</label>
            <input
              id="tradeName"
              value={form.tradeName}
              onChange={(e) => patchForm({ tradeName: e.target.value })}
              data-invalid={err("tradeName") ? "1" : undefined}
            />
            {err("tradeName") ? <p className="p-err">{err("tradeName")}</p> : null}
          </div>
          <div className="p-field">
            <label htmlFor="manufacturer">{t("manufacturer")}</label>
            <input
              id="manufacturer"
              value={form.manufacturer}
              onChange={(e) => patchForm({ manufacturer: e.target.value })}
              data-invalid={err("manufacturer") ? "1" : undefined}
            />
            {err("manufacturer") ? <p className="p-err">{err("manufacturer")}</p> : null}
          </div>
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="modelName">{t("kindAndType")}</label>
            <input
              id="modelName"
              value={form.modelName}
              onChange={(e) => patchForm({ modelName: e.target.value })}
              data-invalid={err("modelName") ? "1" : undefined}
            />
            {err("modelName") ? <p className="p-err">{err("modelName")}</p> : null}
          </div>
          <div className="p-field">
            <label htmlFor="serialNumber">{t("serialNumber")}</label>
            <input
              id="serialNumber"
              value={form.serialNumber}
              onChange={(e) => patchForm({ serialNumber: e.target.value })}
              data-invalid={err("serialNumber") ? "1" : undefined}
            />
            {err("serialNumber") ? <p className="p-err">{err("serialNumber")}</p> : null}
          </div>
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="udiDi">{t("udiDi")}</label>
            <input id="udiDi" value={form.udiDi} onChange={(e) => patchForm({ udiDi: e.target.value })} />
          </div>
          <div className="p-field">
            <label htmlFor="purchaseYear">{t("purchaseYear")}</label>
            <input
              id="purchaseYear"
              value={form.purchaseYear}
              onChange={(e) => patchForm({ purchaseYear: e.target.value })}
              data-invalid={err("purchaseYear") ? "1" : undefined}
            />
            {err("purchaseYear") ? <p className="p-err">{err("purchaseYear")}</p> : null}
          </div>
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="inventoryNumber">{t("assetNumber")}</label>
            <input
              id="inventoryNumber"
              value={form.inventoryNumber}
              onChange={(e) => patchForm({ inventoryNumber: e.target.value })}
              placeholder={t("assetPlaceholder")}
            />
          </div>
          <div className="p-field">
            <label htmlFor="responsiblePerson">{t("responsible")}</label>
            <select
              id="responsiblePerson"
              value={form.responsibleUserId}
              disabled={busy || usersLoading}
              onChange={(e) => {
                const userId = e.target.value;
                const user = users.find((u) => u.id === userId);
                patchForm({
                  responsibleUserId: userId,
                  responsiblePerson: user?.name ?? "",
                });
              }}
              data-invalid={err("responsibleUserId") || err("responsiblePerson") ? "1" : undefined}
              data-testid="registration-responsible"
            >
              <option value="">
                {usersLoading ? tCommon("loading") : t("selectAdmin")}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
            {err("responsibleUserId") || err("responsiblePerson") ? (
              <p className="p-err">{err("responsibleUserId") ?? err("responsiblePerson")}</p>
            ) : null}
          </div>
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="siteId">{t("site")}</label>
            <select
              id="siteId"
              value={form.siteId}
              onChange={(e) => patchForm({ siteId: e.target.value, areaId: "" })}
            >
              <option value="">{t("select")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {err("siteId") ? <p className="p-err">{err("siteId")}</p> : null}
          </div>
          <div className="p-field">
            <label htmlFor="areaId">{t("area")}</label>
            <select id="areaId" value={form.areaId} onChange={(e) => patchForm({ areaId: e.target.value })}>
              <option value="">{t("select")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {err("areaId") ? <p className="p-err">{err("areaId")}</p> : null}
          </div>
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="room">{t("room")}</label>
            <input
              id="room"
              value={form.room}
              onChange={(e) => patchForm({ room: e.target.value })}
              data-invalid={err("room") ? "1" : undefined}
            />
            {err("room") ? <p className="p-err">{err("room")}</p> : null}
          </div>
          <div className="p-field" aria-hidden="true" />
        </div>

        <p className="p-reg__hint">
          One of the identifiers — serial number or UDI-DI — is enough, but not none.
        </p>

        <div className="p-reg__actions">
          <button type="button" className="p-cta" onClick={() => void onContinue()} disabled={busy}>
            {busy ? tCommon("loading") : t("continue")}
          </button>
        </div>
      </div>
    </section>
  );
}
