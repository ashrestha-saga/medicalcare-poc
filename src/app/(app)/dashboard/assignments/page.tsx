import { redirect } from "next/navigation";

/** Legacy path — tile assignments live at /today/assignments. */
export default function DashboardAssignmentsRedirectPage() {
  redirect("/today/assignments");
}
