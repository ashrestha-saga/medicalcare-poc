"use client";

import { useCallback, useState } from "react";
import type { AdminUserDTO } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";
import { api, ApiError } from "@/lib/http/apiClient";
import { createUserSchema, updateUserSchema, resetUserPasswordSchema } from "@/schemas/user";
import { zodFieldErrors } from "@/schemas/formErrors";
import { toast } from "@/store/toastStore";

export type UserFormMode = "create" | "edit";

export function useUserForm(onSaved: () => void) {
  const [mode, setMode] = useState<UserFormMode>("create");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setFieldErrors({});
    setBusy(false);
  }, []);

  const openCreate = useCallback(() => {
    setMode("create");
    setEditing(null);
    setEmail("");
    setName("");
    setRole("user");
    setActive(true);
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setOpen(true);
  }, []);

  const openEdit = useCallback((user: AdminUserDTO) => {
    setMode("edit");
    setEditing(user);
    setEmail(user.email);
    setName(user.name);
    setRole(user.role);
    setActive(user.active);
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setOpen(true);
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setFieldErrors({});
    try {
      if (mode === "create") {
        const parsed = createUserSchema.safeParse({
          email,
          name,
          role,
          password,
          confirmPassword,
          active,
        });
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }
        await api("/api/users", { method: "POST", body: JSON.stringify(parsed.data) });
        toast.success("User created.");
      } else if (editing) {
        const parsed = updateUserSchema.safeParse({ name, role, active });
        if (!parsed.success) {
          setFieldErrors(zodFieldErrors(parsed.error));
          return;
        }
        await api(`/api/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success("User updated.");
      }
      close();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [mode, email, name, role, password, confirmPassword, active, editing, close, onSaved]);

  return {
    open,
    mode,
    editing,
    busy,
    fieldErrors,
    email,
    setEmail,
    name,
    setName,
    role,
    setRole,
    active,
    setActive,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    openCreate,
    openEdit,
    close,
    submit,
  };
}

export function useResetPasswordForm(onDone: () => void) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AdminUserDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [adminPassword, setAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setTarget(null);
    setFieldErrors({});
    setAdminPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  const openFor = useCallback((user: AdminUserDTO) => {
    setTarget(user);
    setAdminPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setOpen(true);
  }, []);

  const submit = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    setFieldErrors({});
    try {
      const parsed = resetUserPasswordSchema.safeParse({
        adminPassword,
        newPassword,
        confirmPassword,
      });
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }
      await api(`/api/users/${target.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Password reset.");
      close();
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }, [target, adminPassword, newPassword, confirmPassword, close, onDone]);

  return {
    open,
    target,
    busy,
    fieldErrors,
    adminPassword,
    setAdminPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    openFor,
    close,
    submit,
  };
}
