import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/Toaster";

/** Public auth chrome — no sidebar, no app shell. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
