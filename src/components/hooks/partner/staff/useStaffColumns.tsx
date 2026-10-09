"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleStaffMemberDTO } from "@/interfaces/console";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { Button } from "@/components/ui/button";

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

function roleBadgeLabel(
  t: ReturnType<typeof useTranslations<"console">>,
  member: ConsoleStaffMemberDTO,
): string {
  if (member.status === "invited") return t("staffStatusInvited");
  if (member.appRole === "admin") return t("staffRoleAdmin");
  if (member.appRole === "order") return t("staffRoleOrder");
  return t("staffRoleInspector");
}

export function useStaffColumns(): ColumnDef<ConsoleStaffMemberDTO>[] {
  const t = useTranslations("console");

  return useMemo(
    () => [
      {
        accessorKey: "name",
        id: "staff",
        header: ({ column }) => <SortHeader label={t("staffColStaff")} column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.jobTitle ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "email",
        id: "subject",
        header: ({ column }) => <SortHeader label={t("staffColSubject")} column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.email}</span>
        ),
      },
      {
        id: "access",
        accessorFn: (row) => (row.status === "invited" ? "invited" : row.appRole),
        header: ({ column }) => <SortHeader label={t("staffColAccess")} column={column} />,
        cell: ({ row }) => (
          <span
            className={
              row.original.status === "invited"
                ? "inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900"
                : "inline-block rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            }
          >
            {roleBadgeLabel(t, row.original)}
          </span>
        ),
      },
      {
        id: "qualifications",
        accessorFn: (row) => row.qualifications.map((q) => q.label).join(" "),
        header: ({ column }) => <SortHeader label={t("staffColQualification")} column={column} />,
        cell: ({ row }) =>
          row.original.qualifications.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.qualifications.map((q) => (
                <span
                  key={q.id}
                  className="inline-block rounded-md border-transparent bg-[rgba(47,217,138,0.12)] px-2 py-0.5 text-[10px] text-[var(--green)]"
                >
                  {q.label}
                </span>
              ))}
            </div>
          ),
      },
      {
        id: "customers",
        accessorFn: (row) => row.assignedClinicNames.join(" "),
        header: ({ column }) => <SortHeader label={t("staffColCustomers")} column={column} />,
        cell: ({ row }) =>
          row.original.assignedClinicNames.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.assignedClinicNames.map((name) => (
                <span
                  key={name}
                  className="inline-block rounded-md border-transparent bg-[rgba(47,217,138,0.12)] px-2 py-0.5 text-[10px] text-[var(--green)]"
                >
                  {name}
                </span>
              ))}
            </div>
          ),
      },
      {
        id: "open",
        enableSorting: false,
        header: () => <span className="sr-only">{t("staffColOpen")}</span>,
        meta: { className: "w-[1%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <OpenButton href={`/partner/staff/${encodeURIComponent(row.original.membershipId)}`} />
        ),
      },
    ],
    [t],
  );
}
