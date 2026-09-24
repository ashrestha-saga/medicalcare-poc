"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn } from "@/components/features/auth/SignIn";
import { Loading } from "@/components/ui/Loading";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { AUTH_HOME, PARTNER_HOME } from "@/constants/authRoutes";
import { isClinicSession, isPartnerSession } from "@/interfaces/session";

function PartnerLoginContent() {
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const { status } = useSession();
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (status === "signed-in" && user) {
      if (isPartnerSession(user)) window.location.replace(PARTNER_HOME);
      else if (isClinicSession(user)) window.location.replace(AUTH_HOME);
    }
  }, [status, user]);

  if (status === "loading") return <Loading label="Checking session…" />;
  if (status === "signed-in" && user) return <Loading label="Opening app…" />;

  return <SignIn notice={notice} door="partner" />;
}

/** /login/partner — partner organisation email/password sign-in. */
export default function PartnerLoginPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <PartnerLoginContent />
    </Suspense>
  );
}
