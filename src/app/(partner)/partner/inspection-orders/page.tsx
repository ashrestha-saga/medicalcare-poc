import { redirect } from "next/navigation";

/** Legacy URL — dispatch/scheduling is Aufträge → Disposition. */
export default function PartnerInspectionOrdersPage() {
  redirect("/partner/orders?tab=disposition");
}
