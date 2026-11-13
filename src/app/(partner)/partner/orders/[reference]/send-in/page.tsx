import { SendInTimeline } from "@/components/features/partner/send-in/SendInTimeline";

type Props = { params: Promise<{ reference: string }> };

export default async function PartnerSendInPage({ params }: Props) {
  const { reference } = await params;
  return <SendInTimeline reference={decodeURIComponent(reference)} />;
}
