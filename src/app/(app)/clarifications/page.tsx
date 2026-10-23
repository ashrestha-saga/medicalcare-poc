import { redirect } from "next/navigation";

/** Legacy /clarifications → Bestand Klärliste tab (v26). */
export default function ClarificationsPage() {
  redirect("/devices?tab=klaerliste");
}
