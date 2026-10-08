import { InspectionProtocolScreen } from "@/components/features/inspect/InspectionProtocolScreen";

type Props = { params: Promise<{ reference: string }> };

export default async function InspectProtocolPage({ params }: Props) {
  const { reference } = await params;
  return <InspectionProtocolScreen reference={decodeURIComponent(reference)} />;
}
