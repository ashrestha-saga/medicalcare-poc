import { ExternalInspectorDetailScreen } from "@/components/features/console/ExternalInspectorDetailScreen";

type Props = { params: Promise<{ membershipId: string }> };

export default async function ExternalInspectorDetailPage({ params }: Props) {
  const { membershipId } = await params;
  return <ExternalInspectorDetailScreen membershipId={membershipId} />;
}
