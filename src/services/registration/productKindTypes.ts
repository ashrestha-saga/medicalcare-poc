export interface ProductKindDTO {
  code: string;
  label: string;
  hint: string | null;
  sortGroup: string;
  shows: string[];
  blocks: string[];
  presets: Record<string, unknown>;
}
