import { OrderDetailScreen } from "@/components/features/partner/orders/OrderDetailScreen";

type Props = { params: Promise<{ reference: string }> };

export default async function PartnerOrderDetailPage({ params }: Props) {
  const { reference } = await params;
  return <OrderDetailScreen reference={decodeURIComponent(reference)} />;
}
