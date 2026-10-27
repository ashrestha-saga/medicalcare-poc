import { redirect } from "next/navigation";

/** Legacy path — Today board lives at /today. */
export default function DashboardRedirectPage() {
  redirect("/today");
}
