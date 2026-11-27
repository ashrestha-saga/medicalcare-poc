import { ShopOrderDetailScreen } from "@/components/features/shop-orders/ShopOrderDetailScreen";

export default async function ShopOrderDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <ShopOrderDetailScreen reference={decodeURIComponent(reference)} />;
}
