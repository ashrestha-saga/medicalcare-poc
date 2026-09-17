"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, KeyRound, Pencil, Trash2 } from "lucide-react";
import type { AdminUserDTO } from "@/interfaces";
import { roleLabel } from "@/constants/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface UsersTableActions {
  canUpdate: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
  onEdit: (user: AdminUserDTO) => void;
  onResetPassword: (user: AdminUserDTO) => void;
  onDelete: (user: AdminUserDTO) => void;
}

function SortHeader({
  label,
  column,
}: {
  label: string;
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
}) {
  return (
    <Button
      type="button"
      variant="tableHeader"
      className="-ml-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
    </Button>
  );
}

export function useUsersColumns(actions: UsersTableActions): ColumnDef<AdminUserDTO>[] {
  const { canUpdate, canDelete, canResetPassword, onEdit, onResetPassword, onDelete } = actions;

  return useMemo(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => <SortHeader label="Name" column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        id: "email",
        header: ({ column }) => <SortHeader label="Email" column={column} />,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
      },
      {
        accessorKey: "role",
        id: "role",
        header: ({ column }) => <SortHeader label="Role" column={column} />,
        cell: ({ row }) => roleLabel(row.original.role),
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.role);
        },
      },
      {
        accessorKey: "active",
        id: "status",
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) =>
          row.original.active ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="destructive">Inactive</Badge>
          ),
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          const status = row.original.active ? "active" : "inactive";
          return value.includes(status);
        },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const user = row.original;
          return (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {canUpdate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--accent)] hover:bg-[rgba(30,127,224,0.14)] hover:text-[var(--accent)]"
                        onClick={() => onEdit(user)}
                        data-testid="user-edit"
                        aria-label={`Edit ${user.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                )}
                {canResetPassword && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--warn)] hover:bg-[rgba(245,165,36,0.14)] hover:text-[var(--warn)]"
                        onClick={() => onResetPassword(user)}
                        data-testid="user-reset"
                        aria-label={`Reset password for ${user.name}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset password</TooltipContent>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--red)] hover:bg-[rgba(255,51,102,0.14)] hover:text-[var(--red)]"
                        onClick={() => onDelete(user)}
                        data-testid="user-delete"
                        aria-label={`Delete ${user.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [canUpdate, canDelete, canResetPassword, onEdit, onResetPassword, onDelete],
  );
}
