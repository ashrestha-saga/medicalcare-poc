import { CustomerDetailScreen } from "@/components/features/partner/customers/CustomerDetailScreen";

type Props = { params: Promise<{ contractId: string }> };

export default async function PartnerCustomerDetailPage({ params }: Props) {
  const { contractId } = await params;
  return <CustomerDetailScreen contractId={contractId} />;
}
