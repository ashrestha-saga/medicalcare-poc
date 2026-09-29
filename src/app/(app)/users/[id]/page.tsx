import { redirect } from "next/navigation";
import { EditUserScreen } from "@/components/features/users/EditUserScreen";

const RESERVED_IDS = new Set(["new"]);

/** /users/[id] — edit clinic user or pending invitation. */
export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (RESERVED_IDS.has(id)) {
    redirect("/users/new");
  }
  return <EditUserScreen params={params} />;
}
