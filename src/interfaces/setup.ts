export type SetupStepId =
  | "sites"
  | "personen"
  | "traegerschaft"
  | "betreuung"
  | "bestand"
  | "einstufung"
  | "klaerliste"
  | "takte"
  | "aufbereitung"
  | "export";

export type SetupStepStatus = "ok" | "open" | "na";

export type SetupStepWhyParams = Record<string, string | number>;

export type SetupStepDTO = {
  id: SetupStepId;
  /** i18n key under `commissioning.steps.*` */
  titleKey: string;
  status: SetupStepStatus;
  /** i18n key under `commissioning.why.*` — client formats with whyParams. */
  whyKey: string;
  whyParams?: SetupStepWhyParams;
  href: string;
};

export type SetupProgressDTO = {
  done: number;
  total: number;
  /** True when every step is ok or na. */
  complete: boolean;
  /** Sidebar chip: open steps remain and not dismissed. */
  showChip: boolean;
  /** User acknowledged 10/10 (Inbetriebnahme abschließen). */
  dismissed: boolean;
  nextStepTitleKey: string | null;
  nextStepHref: string | null;
  steps: SetupStepDTO[];
};
