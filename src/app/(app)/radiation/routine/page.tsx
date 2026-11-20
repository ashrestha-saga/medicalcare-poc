import { redirect } from "next/navigation";

/** Legacy deep link → unified Strahlenschutz page (Routine tab). */
export default function ConstancyRoutineRedirectPage() {
  redirect("/constancy-cadence?tab=routine");
}
