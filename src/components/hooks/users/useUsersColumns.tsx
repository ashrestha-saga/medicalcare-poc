"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AdminUserDTO } from "@/interfaces";
import { roleLabel } from "@/constants/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface UsersTableActions {
  canUpdate: boolean;
  canDelete: boolean;
  canCreate: boolean;
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
  const { canUpdate, canDelete, canCreate, onDelete } = actions;
  const t = useTranslations("table.users");
  const tTable = useTranslations("table");

  return useMemo(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => <SortHeader label={t("name")} column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        id: "email",
        header: ({ column }) => <SortHeader label={t("email")} column={column} />,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
      },
      {
        accessorKey: "role",
        id: "role",
        header: ({ column }) => <SortHeader label={t("role")} column={column} />,
        cell: ({ row }) => roleLabel(row.original.role),
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          return value.includes(row.original.role);
        },
      },
      {
        accessorKey: "active",
        id: "status",
        header: ({ column }) => <SortHeader label={t("status")} column={column} />,
        cell: ({ row }) => {
          const status = row.original.status ?? (row.original.active ? "active" : "inactive");
          if (status === "invited") {
            return <Badge variant="warning">Invited</Badge>;
          }
          return status === "active" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="destructive">Inactive</Badge>
          );
        },
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          const status = row.original.status ?? (row.original.active ? "active" : "inactive");
          return value.includes(status);
        },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{tTable("actions")}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => {
          const user = row.original;
          const href = `/users/${encodeURIComponent(user.id)}`;
          const canOpen =
            canUpdate || (user.status === "invited" && (canCreate || canDelete));
          return (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {canOpen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                        asChild
                        data-testid="user-edit"
                        aria-label={`Edit ${user.name}`}
                      >
                        <Link href={href}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                )}
                {canDelete && user.status !== "invited" && (
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
    [canUpdate, canDelete, canCreate, onDelete, t, tTable],
  );
}
