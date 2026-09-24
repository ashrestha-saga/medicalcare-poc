import { ReclassifyScreen } from "@/components/features/registration/ReclassifyScreen";

/** /registration/reclassify/[modelId] — admin model-wide classification edit. */
export default async function ReclassifyPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = await params;
  return <ReclassifyScreen modelId={modelId} />;
}
