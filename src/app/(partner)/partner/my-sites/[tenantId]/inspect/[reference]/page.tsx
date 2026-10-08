import { redirect } from "next/navigation";

type Props = { params: Promise<{ tenantId: string; reference: string }> };

/** Legacy nested URL — send bookmarks into the field portal. */
export default async function LegacyPartnerInspectRedirect({ params }: Props) {
  const { reference } = await params;
  redirect(`/inspect/${encodeURIComponent(decodeURIComponent(reference))}`);
}
