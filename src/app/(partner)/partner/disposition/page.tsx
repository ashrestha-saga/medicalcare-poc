import { redirect } from "next/navigation";

/** Legacy URL — portfolio list lives under Aufträge → Durchführung. */
export default function PartnerDispositionPage() {
  redirect("/partner/orders?tab=execution");
}
