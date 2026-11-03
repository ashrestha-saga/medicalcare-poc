import { redirect } from "next/navigation";

/** /inspect → Heute (Prüfpartner v10-A default). */
export default function InspectIndexPage() {
  redirect("/inspect/heute");
}
