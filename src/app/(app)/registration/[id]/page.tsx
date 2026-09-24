import { RegistrationScreen } from "@/components/features/registration/RegistrationScreen";

/** /registration/[id] — resume inventarize / existing draft. */
export default async function RegistrationDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RegistrationScreen draftId={id} />;
}
