import { Suspense } from "react";
import { FieldSafetyScreen } from "@/components/features/field-safety/FieldSafetyScreen";

/** /field-safety — FSCA/FSN recalls (fieldsafety:view). */
export default function FieldSafetyPage() {
  return (
    <Suspense fallback={null}>
      <FieldSafetyScreen />
    </Suspense>
  );
}
