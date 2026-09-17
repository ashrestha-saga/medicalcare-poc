"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { AdminUserDTO } from "@/interfaces";
import { ApiError } from "@/lib/http/apiClient";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useUsersList } from "@/components/hooks/users/useUsersList";
import { useUsersColumns } from "@/components/hooks/users/useUsersColumns";
import { useResetPasswordForm, useUserForm } from "@/components/hooks/users/useUserForm";
import { toast } from "@/store/toastStore";
import { UsersFilterToolbar } from "../filter-toolbar";
import { UserFormModal } from "../UserFormModal";
import { ResetPasswordModal } from "../ResetPasswordModal";
import { DeleteUserDialog } from "../DeleteUserDialog";

type ListApi = ReturnType<typeof useUsersList>;

interface UsersTableProps {
  list: ListApi;
}

export function UsersTable({ list }: UsersTableProps) {
  const form = useUserForm(() => void list.refresh());
  const reset = useResetPasswordForm(() => undefined);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roleFilter, setRoleFilter] = useState<string[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[] | null>(null);
  const [keywordInput, setKeywordInput] = useState(list.q);
  const [pendingDelete, setPendingDelete] = useState<AdminUserDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const setKeyword = useCallback(
    (value: string) => {
      setKeywordInput(value);
      list.setQ(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        void list.refresh(value);
      }, 280);
    },
    [list],
  );

  const removeKeyword = useCallback(() => {
    setKeywordInput("");
    list.setQ("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
    void list.refresh("");
  }, [list]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await list.remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }, [list, pendingDelete]);

  const columnActions = useMemo(
    () => ({
      canUpdate: list.canUpdate,
      canDelete: list.canDelete,
      canResetPassword: list.canResetPassword,
      onEdit: form.openEdit,
      onResetPassword: reset.openFor,
      onDelete: setPendingDelete,
    }),
    [
      list.canUpdate,
      list.canDelete,
      list.canResetPassword,
      form.openEdit,
      reset.openFor,
    ],
  );

  const columns = useUsersColumns(columnActions);

  const filtered = useMemo(() => {
    return list.users.filter((u) => {
      if (roleFilter?.length && !roleFilter.includes(u.role)) return false;
      if (statusFilter?.length) {
        const status = u.active ? "active" : "inactive";
        if (!statusFilter.includes(status)) return false;
      }
      return true;
    });
  }, [list.users, roleFilter, statusFilter]);

  return (
    <>
      <div className="space-y-3 px-4 pb-4 sm:px-[18px]" data-testid="users-list">
        <UsersFilterToolbar
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          onRoleChange={(value) => setRoleFilter(Array.isArray(value) ? value : value ? [value] : null)}
          onStatusChange={(value) => setStatusFilter(Array.isArray(value) ? value : value ? [value] : null)}
          onClearAll={() => {
            setRoleFilter(null);
            setStatusFilter(null);
          }}
        />

        <DataTable
          data={filtered}
          columns={columns}
          search
          visibility
          displayPagination
          keyword={keywordInput}
          setKeyword={setKeyword}
          removeKeyword={removeKeyword}
          isLoading={list.loading}
          totalItems={filtered.length}
          getRowId={(row) => row.id}
          emptyMessage="No users found."
          toolbarTrailing={
            list.canCreate ? (
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={form.openCreate}
                data-testid="users-add"
              >
                <Plus className="h-4 w-4" />
                Add user
              </Button>
            ) : null
          }
        />
      </div>

      <UserFormModal form={form} />
      <ResetPasswordModal form={reset} />
      <DeleteUserDialog
        user={pendingDelete}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
