import { SiteAssignmentsScreen } from "@/components/features/console/SiteAssignmentsScreen";

type Props = { params: Promise<{ tenantId: string }> };

/** /partner/my-sites/[tenantId] — institution assignments portal. */
export default async function SiteAssignmentsPage({ params }: Props) {
  const { tenantId } = await params;
  return <SiteAssignmentsScreen tenantId={decodeURIComponent(tenantId)} />;
}
