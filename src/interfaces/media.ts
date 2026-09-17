/** Client-side photo draft before it becomes an AttachmentInputDTO. */
export type PhotoKind = "nameplate" | "fault_photo";

export interface PhotoDraft {
  id: string;
  kind: PhotoKind;
  dataUrl: string;
}

export interface PhotoAttachmentProps {
  kind: PhotoKind;
  label: string;
  photos: PhotoDraft[];
  onAdd: (photo: PhotoDraft) => void;
  onRemove: (id: string) => void;
  max?: number;
  required?: boolean;
  error?: string | null;
  hint?: string;
  buttonLabel?: string;
}
