"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { LoginApiResponse, LoginResponse } from "@/interfaces";
import { AUTH_HOME, PARTNER_HOME } from "@/constants/authRoutes";
import { api, ApiError } from "@/lib/http/apiClient";
import { loginSchema, totpVerifySchema } from "@/schemas/auth";
import { zodFieldErrors } from "@/schemas/formErrors";
import { useLogStore } from "@/store/logStore";
import { toast } from "@/store/toastStore";

type Door = "clinic" | "partner";

/**
 * Email/password sign-in → optional TOTP (clinic) → hard navigate to home.
 */
export function useSignIn(door: Door = "clinic") {
  const [email, setEmail] = useState(door === "partner" ? "k.adler@msr.example" : "anna@demo.local");
  const [password, setPassword] = useState("demo");
  const [code, setCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const finishLogin = useCallback((res: LoginResponse) => {
    const label = res.user.accountKind === "partner" ? res.user.appRole : res.user.role;
    useLogStore.getState().log("auth", `Signed in as ${res.user.name} (${label ?? "user"})`);
    const dest =
      res.homePath ??
      (res.user.accountKind === "partner" || door === "partner" ? PARTNER_HOME : AUTH_HOME);
    window.location.replace(dest);
  }, [door]);

  const submitPassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const parsed = loginSchema.safeParse({ email, password, door });
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }
      setFieldErrors({});
      setBusy(true);
      try {
        const res = await api<LoginApiResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        if ("requires2fa" in res && res.requires2fa) {
          setNeeds2fa(true);
          setCode("");
          setBusy(false);
          return;
        }
        finishLogin(res as LoginResponse);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Sign-in failed.");
        setBusy(false);
      }
    },
    [email, password, door, finishLogin],
  );

  const submitTotp = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const parsed = totpVerifySchema.safeParse({ code });
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }
      setFieldErrors({});
      setBusy(true);
      try {
        const res = await api<LoginResponse>("/api/auth/2fa/verify", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        finishLogin(res);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Invalid code.");
        setBusy(false);
      }
    },
    [code, finishLogin],
  );

  const backToPassword = useCallback(() => {
    setNeeds2fa(false);
    setCode("");
    setFieldErrors({});
  }, []);

  return {
    door,
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    needs2fa,
    busy,
    fieldErrors,
    submitPassword,
    submitTotp,
    backToPassword,
  };
}
