import { SiteAssignmentsScreen } from "@/components/features/partner/my-sites/SiteAssignmentsScreen";

type Props = { params: Promise<{ tenantId: string }> };

export default async function PartnerSiteAssignmentsPage({ params }: Props) {
  const { tenantId } = await params;
  return <SiteAssignmentsScreen tenantId={tenantId} />;
}
