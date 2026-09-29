import { CustomerDetailScreen } from "@/components/features/console/CustomerDetailScreen";

type Props = { params: Promise<{ contractId: string }> };

/** /partner/customers/[contractId] — contract detail + lifecycle. */
export default async function CustomerDetailPage({ params }: Props) {
  const { contractId } = await params;
  return <CustomerDetailScreen contractId={contractId} />;
}
