"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { LoginApiResponse, LoginResponse } from "@/interfaces";
import { AUTH_HOME } from "@/constants/authRoutes";
import { api, ApiError } from "@/lib/http/apiClient";
import { loginSchema, totpVerifySchema } from "@/schemas/auth";
import { zodFieldErrors } from "@/schemas/formErrors";
import { useLogStore } from "@/store/logStore";
import { toast } from "@/store/toastStore";

/**
 * Clinic email/password sign-in → optional TOTP → hard navigate to home.
 */
export function useSignIn() {
  const [email, setEmail] = useState("anna@demo.local");
  const [password, setPassword] = useState("demo");
  const [code, setCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const finishLogin = useCallback((res: LoginResponse) => {
    useLogStore.getState().log("auth", `Signed in as ${res.user.name} (${res.user.role})`);
    window.location.replace(AUTH_HOME);
  }, []);

  const submitPassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const parsed = loginSchema.safeParse({ email, password });
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
    [email, password, finishLogin],
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
