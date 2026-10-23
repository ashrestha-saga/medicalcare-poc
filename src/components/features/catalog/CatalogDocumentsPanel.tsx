"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ModelDocumentDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { Spinner } from "@/components/ui/Loading";

type Props = {
  modelId: string;
  canEdit?: boolean;
};

export function CatalogDocumentsPanel({ modelId, canEdit }: Props) {
  const t = useTranslations("catalogDetail");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<ModelDocumentDTO[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ documents: ModelDocumentDTO[] }>(
        `/api/catalog/models/${encodeURIComponent(modelId)}/documents`,
      );
      setDocs(res.documents.filter((d) => !d.supersededAt));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("documentsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [modelId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      await api(`/api/catalog/models/${encodeURIComponent(modelId)}/documents`, {
        method: "POST",
        body: JSON.stringify({
          kind: "ifu",
          revisionLabel: file.name.replace(/\.[^.]+$/, "") || `ifu-${Date.now()}`,
          language: "de",
          dataUrl,
        }),
      });
      toast.success(t("documentsUploaded"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("documentsUploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const ifus = docs.filter((d) => d.kind === "ifu");

  return (
    <div className="space-y-3" data-testid="catalog-documents-panel">
      <p className="text-sm text-muted-foreground">{t("documentsIntro")}</p>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Spinner />
        </div>
      ) : ifus.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("documentsEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {ifus.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              data-testid={`catalog-doc-${doc.id}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {t("documentsRevision")}: {doc.revisionLabel}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.language} · {doc.recordedByName}
                </p>
              </div>
              {doc.openUrl ? (
                <button
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-sm hover:bg-muted/50"
                  data-testid={`catalog-doc-open-${doc.id}`}
                  onClick={() => window.open(doc.openUrl!, "_blank", "noopener,noreferrer")}
                >
                  {t("documentsOpen")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <label className="inline-flex">
          <input
            type="file"
            accept=".pdf,.md,.txt,.doc,.docx,application/pdf,text/*,image/*"
            className="sr-only"
            disabled={busy}
            data-testid="catalog-ifu-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <span
            className="inline-flex h-8 cursor-pointer items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            aria-disabled={busy}
          >
            {busy ? "…" : t("documentsUpload")}
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">{t("documentsAskEdit")}</p>
      )}
    </div>
  );
}
