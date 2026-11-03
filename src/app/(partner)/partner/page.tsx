import { redirect } from "next/navigation";

/** /partner — Version A lands on Heute. */
export default function PartnerIndexPage() {
  redirect("/partner/today");
}
