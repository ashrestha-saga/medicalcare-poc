import { AssignmentDetailScreen } from "@/components/features/requests/AssignmentDetailScreen";

/** /requests/:reference — single assignment (allocate → transmit). */
export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <AssignmentDetailScreen reference={decodeURIComponent(reference)} />;
}
