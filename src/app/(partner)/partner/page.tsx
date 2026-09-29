import { redirect } from "next/navigation";

/** /partner — operator console lands on customers. */
export default function PartnerIndexPage() {
  redirect("/partner/customers");
}
