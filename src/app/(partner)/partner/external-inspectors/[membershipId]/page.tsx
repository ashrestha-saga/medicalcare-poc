import { ExternalInspectorDetailScreen } from "@/components/features/partner/external-inspectors/ExternalInspectorDetailScreen";

type Props = { params: Promise<{ membershipId: string }> };

export default async function PartnerExternalInspectorDetailPage({ params }: Props) {
  const { membershipId } = await params;
  return <ExternalInspectorDetailScreen membershipId={membershipId} />;
}
