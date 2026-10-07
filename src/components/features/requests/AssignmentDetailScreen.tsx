"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Loading";
import { useAssignmentDetail } from "@/components/hooks/requests/useAssignmentDetail";
import { RequestDetail } from "./RequestDetail";

interface AssignmentDetailScreenProps {
  reference: string;
}

/** Individual assignment at `/requests/[reference]`. */
export function AssignmentDetailScreen({ reference }: AssignmentDetailScreenProps) {
  const t = useTranslations("requestsDetail");
  const router = useRouter();
  const detail = useAssignmentDetail(reference);

  return (
    <div className="p-work" data-testid="assignment-detail-page">
      <main className="p-main">
        <div className="p-admin">
          {detail.loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
              <Spinner /> {t("loadingAssignment")}
            </div>
          ) : detail.notFound || !detail.request ? (
            <div className="space-y-3 px-4 py-10 sm:px-[18px]">
              <p className="text-sm text-muted-foreground">{t("assignmentNotFound")}</p>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => router.push("/requests")}
              >
                {t("backToList")}
              </button>
            </div>
          ) : (
            <RequestDetail
              request={detail.request}
              canWork={detail.canWork}
              canAllocate={detail.canWork}
              executors={detail.executors}
              onBack={() => router.push("/requests")}
              onUpdated={detail.applyUpdated}
            />
          )}
        </div>
      </main>
    </div>
  );
}
