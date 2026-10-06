import { StaffDetailScreen } from "@/components/features/partner/staff/StaffDetailScreen";

type Props = { params: Promise<{ membershipId: string }> };

export default async function StaffDetailPage({ params }: Props) {
  const { membershipId } = await params;
  return <StaffDetailScreen membershipId={membershipId} />;
}
