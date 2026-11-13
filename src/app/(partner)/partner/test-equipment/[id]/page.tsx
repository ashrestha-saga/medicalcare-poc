import { TestEquipmentDetailScreen } from "@/components/features/partner/test-equipment/TestEquipmentDetailScreen";

type Props = { params: Promise<{ id: string }> };

export default async function PartnerTestEquipmentDetailPage({ params }: Props) {
  const { id } = await params;
  return <TestEquipmentDetailScreen id={id} />;
}
