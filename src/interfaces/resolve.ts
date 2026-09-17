import type { ClassificationProposalDTO } from "./classification";
import type { DeviceInstanceDTO, DeviceModelDTO } from "./device";

/** FA-100 — the four stages, in order. */
export type ResolutionStage = "inventory" | "catalog" | "beudamed" | "capture";

export type IdentifierKind = "gtin" | "udi-di" | "inventory" | "serial" | "unknown";

/** Output of the isomorphic GS1 parser (Section 17). Immutable by convention. */
export interface ParsedIdentifier {
  readonly raw: string;
  readonly kind: IdentifierKind;
  readonly gtin?: string;
  readonly udiDi?: string;
  readonly lot?: string;
  readonly serial?: string;
  readonly expiry?: string;
  /** Free-text candidate used for inventory/serial lookup when no GS1 structure is found. */
  readonly text?: string;
}

export interface ResolveRequest {
  raw: string;
  tenantId: string;
  context: "service";
}

export interface ResolveSource {
  system: "device-inventory" | "catalog" | "oxid-catalog" | "beudamed" | "none";
  fetchedAt: string;
  cached: boolean;
}

/** Section 19 — stable regardless of which stage answered. */
export interface ResolveResponse {
  stage: ResolutionStage;
  identifier: ParsedIdentifier;
  device?: DeviceInstanceDTO;
  model?: DeviceModelDTO;
  classificationProposal?: ClassificationProposalDTO;
  source: ResolveSource;
  correlationId: string;
}
