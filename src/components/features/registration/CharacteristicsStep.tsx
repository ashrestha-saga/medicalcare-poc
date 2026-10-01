"use client";

import { useTranslations } from "next-intl";
import type { RegistrationWizardApi } from "@/components/hooks/registration/useRegistrationWizard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  answerProgressCounts,
  fieldMeta,
  MESSGROESSEN,
  messgroesseByKey,
  messgroesseNeedsVariante,
  showsAedExemptionQuestion,
  zifferAus,
} from "@/components/hooks/registration/registrationHelpers";
import { kindDisplay, kindGroupColumns, kindGroupKey } from "./kindDisplay";
import {
  ProposalBanner,
  ProposalSummaryCard,
  SuggestableField,
  YesNoAnswer,
} from "./AnswerControls";
import { CheckRulesPanel, FieldCheckRules } from "./CheckRulesPanel";

export function CharacteristicsStep({
  w,
}: {
  w: RegistrationWizardApi;
}) {
  const t = useTranslations("registration");
  const {
    selectedKind,
    kinds,
    kindQ,
    setKindQ,
    kindGroups,
    selectProductKind,
    setStep,
    merkmale,
    patchMerkmale,
    answer,
    confirmField,
    acknowledgeRule,
    checkHits,
    openChecks,
    answerMessung,
    answerMessungVariante,
    show,
    refData,
    annex2Leaves,
    selectedAnnex2,
    selectedRadiation,
    selectedReproc,
    selectedEquipment,
    busy,
    saveCharacteristicsAndDerive,
  } = w;

  const fieldLabel = (key: string) => (t.has(`fields.${key}`) ? t(`fields.${key}`) : key);
  const messLabel = (k: string, fallback: string) =>
    t.has(`messgroessen.${k}`) ? t(`messgroessen.${k}`) : fallback;
  const kindCard = (code: string, fallbackLabel: string, fallbackHint: string | null) => {
    const d = kindDisplay(code, fallbackLabel, fallbackHint);
    return {
      label: t.has(`kinds.${code}.label`) ? t(`kinds.${code}.label`) : d.label,
      hint: t.has(`kinds.${code}.hint`) ? t(`kinds.${code}.hint`) : d.hint,
    };
  };
  const groupTitle = (group: string) => {
    const key = kindGroupKey(group);
    return key ? t(`kindGroups.${key}`) : group;
  };

  if (!selectedKind) {
    const sonstiges = kinds.find((k) => k.code === "sonstiges");
    const sonstigesDisplay = sonstiges
      ? kindCard(sonstiges.code, sonstiges.label, sonstiges.hint)
      : null;

    return (
      <section className="p-reg__step-body" data-testid="registration-step-characteristics">
        <div className="p-reg__card">
          <h3 className="p-reg__section">{t("kindQuestion")}</h3>
          <p className="p-reg__lead">{t("kindLead")}</p>

          <div className="p-field p-reg__search">
            <input
              placeholder={t("kindSearch")}
              value={kindQ}
              onChange={(e) => setKindQ(e.target.value)}
              aria-label={t("kindSearchAria")}
            />
          </div>

          {[...kindGroups.entries()].map(([group, list]) => {
            const cols = kindGroupColumns(group);
            return (
              <div key={group} className="p-reg__kind-block">
                <p className="p-reg__section p-reg__section--tight">{groupTitle(group)}</p>
                <div
                  className="p-reg__kind-grid"
                  data-cols={cols}
                  style={{ ["--p-reg-cols" as string]: String(cols) }}
                >
                  {list.map((k) => {
                    const d = kindCard(k.code, k.label, k.hint);
                    return (
                      <button
                        key={k.code}
                        type="button"
                        className="p-reg__kind"
                        onClick={() => selectProductKind(k)}
                      >
                        <span className="p-reg__kind-title">{d.label}</span>
                        <span className="p-reg__kind-hint">{d.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {sonstiges && sonstigesDisplay ? (
            <div className="p-reg__kind-block">
              <p className="p-reg__section p-reg__section--tight">{t("kindNoneApply")}</p>
              <button
                type="button"
                className="p-reg__kind p-reg__kind--wide"
                onClick={() => selectProductKind(sonstiges)}
              >
                <span className="p-reg__kind-title">{sonstigesDisplay.label}</span>
                <span className="p-reg__kind-hint">{sonstigesDisplay.hint}</span>
              </button>
            </div>
          ) : null}
        </div>

        <button type="button" className="p-cta ghost p-reg__back" onClick={() => setStep(1)}>
          {t("back")}
        </button>
      </section>
    );
  }

  const selectedDisplay = kindCard(selectedKind.code, selectedKind.label, selectedKind.hint);
  const progress = answerProgressCounts(merkmale, selectedKind);
  const wartungSuggested =
    fieldMeta(merkmale, "wartungIntervall")?.state === "vorschlag" ||
    fieldMeta(merkmale, "wartungQuelle")?.state === "vorschlag";

  const showNested = (parent: "aktiv" | "strahlung" | "software" | "aufbereitung") => {
    const v = merkmale[parent];
    const meta = fieldMeta(merkmale, parent);
    return (
      v === true &&
      (meta?.state === "vorschlag_bestaetigt" ||
        meta?.state === "selbst_gewaehlt" ||
        meta?.state === "vorschlag")
    );
  };

  return (
    <section className="p-reg__step-body" data-testid="registration-step-characteristics">
      <div className="p-reg__card space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="p-reg__eyebrow">{t("deviceKind")}</p>
            <h2 className="text-base font-semibold text-[var(--on-dark)]">{selectedDisplay.label}</h2>
            <p className="mt-1 text-sm text-[var(--on-dark-soft)]">{selectedDisplay.hint}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => w.resetCharacteristics()}>
            {t("change")}
          </Button>
        </div>

        <p className="p-reg__eyebrow">{t("charsTrigger")}</p>

        {show("wartung") ? (
          <div className="p-reg__char-block">
            <div className="p-reg__char-block-head">
              <h3 className="p-reg__char-title">{t("maintenance")}</h3>
              <span className="p-reg__char-ref">{t("maintenanceRef")}</span>
            </div>
            <div className="p-grid2 p-grid2--always">
              <SuggestableField
                label={fieldLabel("wartungIntervall")}
                meta={fieldMeta(merkmale, "wartungIntervall")}
                hideBanner
              >
                <div className="p-field">
                  <input
                    type="number"
                    value={merkmale.wartungIntervall ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n) || e.target.value === "") return;
                      answer("wartungIntervall", n);
                    }}
                  />
                </div>
              </SuggestableField>
              <SuggestableField
                label={fieldLabel("wartungQuelle")}
                meta={fieldMeta(merkmale, "wartungQuelle")}
                hideBanner
              >
                <div className="p-field">
                  <select
                    value={merkmale.wartungQuelle ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      answer("wartungQuelle", v as "hersteller" | "eigen");
                    }}
                    data-testid="wartung-quelle"
                  >
                    <option value="">{t("select")}</option>
                    <option value="hersteller">{t("originManufacturer")}</option>
                    <option value="eigen">{t("originOperator")}</option>
                  </select>
                </div>
              </SuggestableField>
            </div>
            {merkmale.wartungQuelle === "eigen" ? (
              <SuggestableField
                label={fieldLabel("wartungBegruendung")}
                meta={fieldMeta(merkmale, "wartungBegruendung")}
              >
                <div className="p-field">
                  <textarea
                    value={merkmale.wartungBegruendung ?? ""}
                    placeholder={
                      t.has("intervalJustificationPlaceholder")
                        ? t("intervalJustificationPlaceholder")
                        : "Why this interval — intensity of use, experience, missing manufacturer specification"
                    }
                    rows={3}
                    onChange={(e) => answer("wartungBegruendung", e.target.value)}
                    data-testid="wartung-begruendung"
                    required
                  />
                  <p className="p-reg__hint p-reg__hint--warn">
                    {t.has("intervalJustificationHint")
                      ? t("intervalJustificationHint")
                      : "A self-set interval without justification cannot be defended in an inspection."}
                  </p>
                </div>
              </SuggestableField>
            ) : null}
            {wartungSuggested ? (
              <ProposalBanner
                onAccept={() => {
                  confirmField("wartungIntervall");
                  confirmField("wartungQuelle");
                }}
              />
            ) : null}
          </div>
        ) : null}

        {show("stk") ? (
          <div className="p-reg__char-block space-y-2">
            <div className="p-reg__char-block-head">
              <h3 className="p-reg__char-title">{t("stk")}</h3>
              <span className="p-reg__char-ref">{t("stkRef")}</span>
            </div>
            <YesNoAnswer
              label={fieldLabel("aktiv")}
              hint={t("aktivHint")}
              value={merkmale.aktiv}
              meta={fieldMeta(merkmale, "aktiv")}
              onAnswer={(v) => answer("aktiv", v)}
              onConfirm={() => confirmField("aktiv")}
              testId="answer-aktiv"
            />
            <FieldCheckRules
              field="aktiv"
              hits={checkHits}
              merkmale={merkmale}
              onAcknowledge={acknowledgeRule}
            />
            {showNested("aktiv") ? (
              <div className="ml-2 space-y-2 border-l border-[var(--border)] pl-3">
                <YesNoAnswer
                  label={fieldLabel("anlage1")}
                  value={merkmale.anlage1}
                  meta={fieldMeta(merkmale, "anlage1")}
                  onAnswer={(v) => answer("anlage1", v)}
                  onConfirm={() => confirmField("anlage1")}
                />
                <FieldCheckRules
                  field="anlage1"
                  hits={checkHits}
                  merkmale={merkmale}
                  onAcknowledge={acknowledgeRule}
                />
                <YesNoAnswer
                  label={fieldLabel("altgeraet")}
                  value={merkmale.altgeraet}
                  meta={fieldMeta(merkmale, "altgeraet")}
                  onAnswer={(v) => answer("altgeraet", v)}
                  onConfirm={() => confirmField("altgeraet")}
                />
                <FieldCheckRules
                  field="altgeraet"
                  hits={checkHits}
                  merkmale={merkmale}
                  onAcknowledge={acknowledgeRule}
                />
                {showsAedExemptionQuestion(merkmale.produktart) ? (
                  <YesNoAnswer
                    label={fieldLabel("aedAusnahme")}
                    value={merkmale.aedAusnahme}
                    meta={fieldMeta(merkmale, "aedAusnahme")}
                    onAnswer={(v) => answer("aedAusnahme", v)}
                    onConfirm={() => confirmField("aedAusnahme")}
                    disabled={merkmale.anlage1 !== true}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {show("mtk") ? (
          <div className="p-reg__char-block space-y-3" data-testid="mtk-block">
            <div className="p-reg__char-block-head">
              <span className="p-reg__char-title">{t("mtk")}</span>
              <span className="p-reg__char-ref">{t("mtkRef")}</span>
            </div>
            <SuggestableField label={t("whatMeasures")} meta={fieldMeta(merkmale, "messgroesse")}>
              <div className="p-field">
                <select
                  value={merkmale.messgroesse ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    answerMessung(v);
                  }}
                  data-testid="messgroesse-select"
                >
                  <option value="">{t("select")}</option>
                  {MESSGROESSEN.map((x) => (
                    <option key={x.k} value={x.k}>
                      {messLabel(x.k, x.t)}
                    </option>
                  ))}
                </select>
              </div>
            </SuggestableField>
            <FieldCheckRules
              field="messgroesse"
              hits={checkHits}
              merkmale={merkmale}
              onAcknowledge={acknowledgeRule}
            />
            {messgroesseNeedsVariante(merkmale.messgroesse) ? (
              <SuggestableField
                label={messgroesseByKey(merkmale.messgroesse || "")?.frage ?? t("variant")}
                meta={fieldMeta(merkmale, "messvariante")}
              >
                <div className="p-field">
                  <select
                    value={merkmale.messvariante ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      answerMessungVariante(v);
                    }}
                    data-testid="messvariante-select"
                  >
                    <option value="">{t("select")}</option>
                    {(messgroesseByKey(merkmale.messgroesse || "")?.varianten ?? []).map((v) => (
                      <option key={v.k} value={v.k}>
                        {v.t}
                      </option>
                    ))}
                  </select>
                </div>
              </SuggestableField>
            ) : null}
            {messgroesseByKey(merkmale.messgroesse || "")?.hinweis ? (
              <p className="p-reg__hint">{messgroesseByKey(merkmale.messgroesse || "")!.hinweis}</p>
            ) : null}
            {(() => {
              const z = zifferAus({
                messgroesse: merkmale.messgroesse,
                messvariante: merkmale.messvariante,
              });
              const leaf =
                selectedAnnex2 ??
                (z ? annex2Leaves.find((a) => a.itemNo === z) ?? null : null);
              if (leaf) {
                const years = leaf.intervalYears;
                return (
                  <div className="p-reg__derived" data-testid="mtk-derived">
                    <span className="p-reg__derived-label">{t("derived")}</span>
                    <b>
                      Anlage 2 Nr. {leaf.itemNo} · {leaf.label}
                    </b>
                    <em>
                      Interval{" "}
                      {years == null
                        ? "from ordinance"
                        : `${years} ${t("years")}`}
                      , counted to year end — not selectable; follows from the measured quantity.
                    </em>
                    {leaf.wahlweiseNach?.length ? (
                      <div className="p-field mt-2">
                        <Label>{fieldLabel("anlage2Verfahren")}</Label>
                        <select
                          value={merkmale.anlage2Verfahren ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            answer("anlage2Verfahren", v);
                          }}
                        >
                          <option value="">{t("select")}</option>
                          {leaf.wahlweiseNach.map((opt) => (
                            <option key={opt} value={opt}>
                              After Nr. {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                );
              }
              if (messgroesseNeedsVariante(merkmale.messgroesse) && !merkmale.messvariante) {
                return (
                  <p className="p-reg__hint p-reg__hint--warn">
                    {t("verfahrenHint")}
                  </p>
                );
              }
              return null;
            })()}
            {show("wartung") &&
            zifferAus({
              messgroesse: merkmale.messgroesse,
              messvariante: merkmale.messvariante,
            }) ? (
              <p className="p-reg__hint">{t("mtkIndependent")}</p>
            ) : null}
          </div>
        ) : null}

        {show("strahlung") ? (
          <div className="space-y-2">
            <p className="p-reg__eyebrow">{t("radiation")}</p>
            <YesNoAnswer
              label={fieldLabel("strahlung")}
              value={merkmale.strahlung}
              meta={fieldMeta(merkmale, "strahlung")}
              onAnswer={(v) => answer("strahlung", v)}
              onConfirm={() => confirmField("strahlung")}
              testId="answer-strahlung"
            />
            {showNested("strahlung") ? (
              <div className="ml-2 space-y-2 border-l border-[var(--border)] pl-3">
                <SuggestableField
                  label={fieldLabel("strahlenArt")}
                  meta={fieldMeta(merkmale, "strahlenArt")}
                  onConfirm={() => confirmField("strahlenArt")}
                >
                  <div className="p-field">
                    <select
                      value={merkmale.strahlenArt ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        answer("strahlenArt", v);
                        const zul =
                          v === "roentgen" ? "anzeige" : "genehmigung";
                        // FA-213 — authorization follows as suggestion when type changes
                        w.suggestZulassung(zul);
                      }}
                    >
                      <option value="">{t("select")}</option>
                      {(refData?.radiation ?? []).map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {selectedRadiation?.medicalBoardNote ? (
                      <p className="mt-2 text-xs text-[var(--on-dark-soft)]">{selectedRadiation.medicalBoardNote}</p>
                    ) : null}
                  </div>
                </SuggestableField>
                <SuggestableField
                  label={fieldLabel("zulassung")}
                  meta={fieldMeta(merkmale, "zulassung")}
                  onConfirm={() => confirmField("zulassung")}
                >
                  <div className="p-field">
                    <select
                      value={merkmale.zulassung ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        answer("zulassung", v);
                      }}
                    >
                      <option value="">{t("select")}</option>
                      <option value="anzeige">{t("notification")}</option>
                      <option value="genehmigung">{t("licence")}</option>
                    </select>
                  </div>
                </SuggestableField>
                <div>
                  <Label>{t("constancyTests")}</Label>
                  {(refData?.constancy ?? []).map((c) => {
                    const on = (merkmale.konstanz ?? []).some((x) => x.k === c.code);
                    return (
                      <label key={c.code} className="mt-1 flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => {
                            const list = merkmale.konstanz ?? [];
                            patchMerkmale({
                              konstanz: v
                                ? [...list, { k: c.code, intervall: c.defaultCadence }]
                                : list.filter((x) => x.k !== c.code),
                            });
                          }}
                        />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {show("software") ? (
          <div className="space-y-2">
            <p className="p-reg__eyebrow">{t("softwareBlock")}</p>
            <YesNoAnswer
              label={fieldLabel("software")}
              value={merkmale.software}
              meta={fieldMeta(merkmale, "software")}
              onAnswer={(v) => answer("software", v)}
              onConfirm={() => confirmField("software")}
            />
            <FieldCheckRules
              field="software"
              hits={checkHits}
              merkmale={merkmale}
              onAcknowledge={acknowledgeRule}
            />
            {showNested("software") ? (
              <SuggestableField
                label={fieldLabel("swKlasse")}
                meta={fieldMeta(merkmale, "swKlasse")}
                onConfirm={() => confirmField("swKlasse")}
              >
                <div className="p-field ml-2 max-w-md">
                  <select
                    value={merkmale.swKlasse ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      answer("swKlasse", v);
                    }}
                  >
                    <option value="">{t("select")}</option>
                    <option value="keine">Class I/IIa or A/B — § 17 does not apply</option>
                    <option value="IIb">SaMD IIb</option>
                    <option value="III">SaMD III</option>
                    <option value="C">SaIVD C</option>
                    <option value="D">SaIVD D</option>
                  </select>
                </div>
              </SuggestableField>
            ) : null}
          </div>
        ) : null}

        {show("aufbereitung") ? (
          <div className="space-y-2">
            <p className="p-reg__eyebrow">{t("reprocessing")}</p>
            <YesNoAnswer
              label={fieldLabel("aufbereitung")}
              value={merkmale.aufbereitung}
              meta={fieldMeta(merkmale, "aufbereitung")}
              onAnswer={(v) => answer("aufbereitung", v)}
              onConfirm={() => confirmField("aufbereitung")}
            />
            <FieldCheckRules
              field="aufbereitung"
              hits={checkHits}
              merkmale={merkmale}
              onAcknowledge={acknowledgeRule}
            />
            {showNested("aufbereitung") ? (
              <div className="ml-2 space-y-2 border-l border-[var(--border)] pl-3">
                <SuggestableField
                  label={fieldLabel("aufbKlasse")}
                  meta={fieldMeta(merkmale, "aufbKlasse")}
                  onConfirm={() => confirmField("aufbKlasse")}
                >
                  <div className="p-field">
                    <select
                      value={merkmale.aufbKlasse ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        answer("aufbKlasse", v);
                      }}
                    >
                      <option value="">{t("select")}</option>
                      {(refData?.reprocessing ?? []).map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                          {r.requiresQmsCert ? " · QM cert required" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </SuggestableField>
                {selectedReproc?.note ? (
                  <p className="text-xs text-[var(--on-dark-soft)]">{selectedReproc.note}</p>
                ) : null}
                <YesNoAnswer
                  label={fieldLabel("aufbExtern")}
                  value={merkmale.aufbExtern}
                  meta={fieldMeta(merkmale, "aufbExtern")}
                  onAnswer={(v) => answer("aufbExtern", v)}
                  onConfirm={() => confirmField("aufbExtern")}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {show("zubehoer") ? (
          <div className="space-y-2">
            <Label>{fieldLabel("zubehoer")}</Label>
            <p className="text-xs text-[var(--on-dark-soft)]">{t("zubehoerHint")}</p>
            <div className="flex flex-wrap gap-2">
              {(refData?.zubehoerTemplates ?? []).map((tpl) => {
                const on = (merkmale.zubehoer ?? []).some((z) => z.t === tpl.t);
                return (
                  <Button
                    key={tpl.t}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => {
                      const list = merkmale.zubehoer ?? [];
                      patchMerkmale({
                        zubehoer: on
                          ? list.filter((z) => z.t !== tpl.t)
                          : [...list, { t: tpl.t, klasse: tpl.klasse }],
                      });
                    }}
                  >
                    {tpl.t}
                    <span className="ml-1 opacity-70">({tpl.klasse})</span>
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        {show("eigenAufb") ? (
          <SuggestableField
            label={fieldLabel("eigenTyp")}
            meta={fieldMeta(merkmale, "eigenTyp")}
            onConfirm={() => confirmField("eigenTyp")}
          >
            <div className="p-field">
              <select
                value={merkmale.eigenTyp ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  answer("eigenTyp", v);
                }}
              >
                <option value="">{t("select")}</option>
                {(refData?.equipment ?? []).map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.label}
                  </option>
                ))}
              </select>
              {selectedEquipment ? (
                <div className="mt-2 space-y-1 rounded-md border border-[var(--border)] bg-[var(--navy)]/40 p-3 text-xs text-[var(--on-dark-soft)]">
                  <p>
                    <span className="font-medium text-[var(--on-dark)]">{t("validation")} </span>
                    {selectedEquipment.validationStandard} ·{" "}
                    {t("revalidationEvery", {
                      months: selectedEquipment.revalidationMonths,
                      unit: t("months"),
                    })}
                  </p>
                  <p>{selectedEquipment.intervalSource}</p>
                </div>
              ) : null}
            </div>
          </SuggestableField>
        ) : null}

        {show("vernetzt") ? (
          <>
            <YesNoAnswer
              label={fieldLabel("vernetzt")}
              value={merkmale.vernetzt}
              meta={fieldMeta(merkmale, "vernetzt")}
              onAnswer={(v) => answer("vernetzt", v)}
              onConfirm={() => confirmField("vernetzt")}
            />
            <FieldCheckRules
              field="vernetzt"
              hits={checkHits}
              merkmale={merkmale}
              onAcknowledge={acknowledgeRule}
            />
          </>
        ) : null}

        {show("implantat") ? (
          <>
            <YesNoAnswer
              label={fieldLabel("implantat")}
              value={merkmale.implantat}
              meta={fieldMeta(merkmale, "implantat")}
              onAnswer={(v) => answer("implantat", v)}
              onConfirm={() => confirmField("implantat")}
            />
            <FieldCheckRules
              field="implantat"
              hits={checkHits}
              merkmale={merkmale}
              onAcknowledge={acknowledgeRule}
            />
          </>
        ) : null}

        {show("einmal") ? (
          <YesNoAnswer
            label={fieldLabel("einmalprodukt")}
            value={merkmale.einmalprodukt}
            meta={fieldMeta(merkmale, "einmalprodukt")}
            onAnswer={(v) => answer("einmalprodukt", v)}
            onConfirm={() => confirmField("einmalprodukt")}
          />
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => patchMerkmale({ weitere: !merkmale.weitere })}
        >
          {merkmale.weitere ? t("hideFurther") : t("showFurther")}
        </Button>
        {!merkmale.weitere ? (
          <p className="p-reg__hint">{t("furtherHint")}</p>
        ) : null}

        <ProposalSummaryCard
          confirmed={progress.confirmed}
          proposals={progress.proposals}
          unanswered={progress.unanswered}
          onConfirmAll={() => w.confirmAllPending()}
        />

        <CheckRulesPanel
          hits={checkHits}
          merkmale={merkmale}
          onAcknowledge={acknowledgeRule}
        />

        <div className="p-reg__actions">
          <button type="button" className="p-cta ghost" onClick={() => setStep(1)}>
            {t("back")}
          </button>
          <button
            type="button"
            className="p-cta"
            onClick={() => void saveCharacteristicsAndDerive()}
            disabled={busy || openChecks.length > 0}
            data-testid="derive-duties"
          >
            {t("deriveDuties")}
          </button>
        </div>
      </div>
    </section>
  );
}
