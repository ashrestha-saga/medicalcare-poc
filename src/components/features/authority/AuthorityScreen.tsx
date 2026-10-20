"use client";

import Link from "next/link";
import { useState } from "react";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import {
  useAuthorityList,
  type BegehMode,
  type BegehTab,
} from "@/components/hooks/authority/useAuthorityList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AuthorityFindingDTO } from "@/interfaces";
import { cn } from "@/lib/utils";

const MODES: { key: BegehMode; label: string }[] = [
  { key: "vorbereitung", label: "Preparation" },
  { key: "begehung", label: "Inspection" },
];

const TABS: { key: BegehTab; label: string }[] = [
  { key: "luecken", label: "Open points" },
  { key: "mappe", label: "Dossier" },
  { key: "befunde", label: "Findings" },
  { key: "notifications", label: "Notifications" },
  { key: "disclosure", label: "Disclosure" },
];

const MAPPE_LABELS: Record<string, string> = {
  bestandsverzeichnis: "Inventory",
  medizinproduktebuch: "Device book",
  nachweise: "Evidence",
  einweisungen: "Instruction",
  pruefungen: "Inspections",
  deckblatt: "Cover",
  aufbereitung: "Reprocessing",
  "offene-punkte": "Open points",
};

export function AuthorityScreen() {
  const list = useAuthorityList();
  const [remediateTarget, setRemediateTarget] = useState<AuthorityFindingDTO | null>(null);
  const [note, setNote] = useState("");
  const [notifyRecipient, setNotifyRecipient] = useState("");
  const [discloseOpen, setDiscloseOpen] = useState(false);
  const [audience, setAudience] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="authority-denied">
        <main className="p-main">
          <ListPageShell
            title="Authority"
            description="You do not have permission to view authority inspections."
          >
            <p className="text-sm text-muted-foreground">Access denied.</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const cl = list.activeChecklist;
  const uncovered = cl?.items.filter((i) => !i.covered).length ?? 0;
  const readOnly = list.mode === "begehung";

  const submitRemediate = async () => {
    if (!remediateTarget || !note.trim()) return;
    setBusy(true);
    try {
      await list.remediate(remediateTarget.id, note.trim(), {
        notifyRecipient: notifyRecipient.trim() || null,
      });
      setRemediateTarget(null);
      setNote("");
      setNotifyRecipient("");
    } finally {
      setBusy(false);
    }
  };

  const submitDisclosure = async () => {
    if (!audience.trim() || !expiresAt) return;
    const scope = cl?.items.map((i) => i.mapsToSection).filter(Boolean) as string[];
    setBusy(true);
    try {
      await list.openDisclosure({
        audience: audience.trim(),
        purpose: purpose.trim() || null,
        expiresAt: new Date(expiresAt).toISOString(),
        scope: scope.length ? [...new Set(scope)] : ["deckblatt"],
      });
      setDiscloseOpen(false);
      setAudience("");
      setPurpose("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-work" data-testid="authority-page">
      <main className="p-main space-y-6">
        <ListPageShell
          title="Authority inspection"
          description="The inspector has no login. The operator opens a session, sets scope, and shows. Two modes: preparation is loud about gaps; inspection is read-only and logged. Gaps stay visible in both."
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-muted-foreground">Mode</span>
            {MODES.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={list.mode === key ? "default" : "outline"}
                className={cn(list.mode === key && "pointer-events-none")}
                onClick={() => list.setMode(key)}
                data-testid={`authority-mode-${key}`}
              >
                {label}
              </Button>
            ))}
            {list.checklists.length > 0 ? (
              <>
                <span className="ml-2 self-center text-xs font-medium text-muted-foreground">
                  Checklist
                </span>
                {list.checklists.map((c) => (
                  <Button
                    key={c.code}
                    type="button"
                    size="sm"
                    variant={cl?.code === c.code ? "default" : "outline"}
                    onClick={() => list.setChecklist(c.code)}
                  >
                    {c.label}
                  </Button>
                ))}
              </>
            ) : null}
          </div>

          <div
            className={cn(
              "mb-4 rounded-md border p-3 text-sm",
              list.mode === "vorbereitung"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-border bg-muted/40",
            )}
          >
            {list.mode === "vorbereitung" ? (
              <p>
                <b>Preparation mode.</b> Intentionally unfriendly — shows what an authority would
                miss before they arrive.
              </p>
            ) : (
              <p>
                <b>Inspection mode.</b> Read-only, limited to disclosure scope, every access
                logged. Gaps remain visible — hiding a row would misrepresent the house.
                {list.sessions.some((s) => s.active)
                  ? ` ${list.sessions.filter((s) => s.active).length} active session(s).`
                  : " No session open yet; preview shows what a session would expose."}
              </p>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-2xl font-semibold">{cl?.totalCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Checklist items</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-2xl font-semibold">{cl?.coveredCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Covered in product</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-2xl font-semibold">{list.prepMeta.openFindings}</p>
              <p className="text-xs text-muted-foreground">
                Open findings
                {list.prepMeta.overdueFindings
                  ? ` (${list.prepMeta.overdueFindings} overdue)`
                  : ""}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-2xl font-semibold">{list.prepMeta.remediatedUnproven}</p>
              <p className="text-xs text-muted-foreground">Remediated, proof open</p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map(({ key, label }) => {
              const n =
                key === "luecken"
                  ? list.gaps.length
                  : key === "mappe"
                    ? (cl?.totalCount ?? 0)
                    : key === "befunde"
                      ? list.findings.length
                      : key === "notifications"
                        ? list.notifications.length
                        : list.sessions.length;
              return (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={list.tab === key ? "default" : "outline"}
                  className={cn(list.tab === key && "pointer-events-none")}
                  onClick={() => list.setTab(key)}
                  data-testid={`authority-tab-${key}`}
                >
                  {label} ({n})
                </Button>
              );
            })}
          </div>

          {list.loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              {list.tab === "luecken" ? (
                <section>
                  {list.mode === "begehung" ? (
                    <p className="mb-3 text-sm text-muted-foreground">
                      This list stays during inspection. Removing it would show the authority a
                      different picture than the house itself.
                    </p>
                  ) : null}
                  {list.gaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No open points in covered areas. Checklist items without a product home
                      still appear in the dossier as “outside the system”.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {list.gaps.map((g) => (
                        <li
                          key={g.href + g.label}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                        >
                          <div>
                            <span className="font-mono font-semibold">{g.count}</span>{" "}
                            <span className="text-muted-foreground">{g.label}</span>
                          </div>
                          {!readOnly ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={g.href}>Open</Link>
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {list.tab === "mappe" && cl ? (
                <section>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Order from checklist {cl.code}
                    {cl.sourceRef ? ` · ${cl.sourceRef}` : ""}
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {uncovered} item(s) not covered in the product — prove outside if asked.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="py-1 pr-2">#</th>
                          <th className="py-1 pr-2">Point</th>
                          <th className="py-1 pr-2">Basis</th>
                          <th className="py-1 pr-2">Section</th>
                          <th className="py-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cl.items.map((item) => (
                          <tr key={item.position} className="border-b border-border/50">
                            <td className="py-2 pr-2 font-mono text-xs">{item.position}</td>
                            <td className="py-2 pr-2">{item.label}</td>
                            <td className="py-2 pr-2 text-xs text-muted-foreground">
                              {item.legalBasis ?? "—"}
                            </td>
                            <td className="py-2 pr-2 text-xs">
                              {item.mapsToSection
                                ? MAPPE_LABELS[item.mapsToSection] ?? item.mapsToSection
                                : "—"}
                            </td>
                            <td className="py-2 text-xs">
                              {item.covered ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  covered{item.live ? " (live)" : ""}
                                </span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400">
                                  not in product
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {list.tab === "befunde" ? (
                <section>
                  {list.findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No findings recorded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.findings.map((f) => (
                        <li
                          key={f.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm"
                          data-testid={`finding-${f.id}`}
                        >
                          <div>
                            <p className="font-medium">
                              {f.itemNo ? `#${f.itemNo} · ` : ""}
                              {f.status}
                              {f.dueAt ? ` · due ${f.dueAt}` : ""}
                            </p>
                            <p className="mt-1 text-muted-foreground">{f.description}</p>
                            {f.remediationNote ? (
                              <p className="mt-1 text-xs">Remediation: {f.remediationNote}</p>
                            ) : null}
                          </div>
                          {f.status === "open" && !readOnly ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setRemediateTarget(f);
                                setNote("");
                                setNotifyRecipient("");
                              }}
                            >
                              Remediate
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {list.inspections.length > 0 ? (
                    <div className="mt-6">
                      <h3 className="mb-2 text-sm font-semibold">Inspections</h3>
                      <ul className="space-y-2">
                        {list.inspections.map((i) => (
                          <li key={i.id} className="rounded-md border p-3 text-sm">
                            <p className="font-medium">
                              {i.authorityName} · {i.visitedAt}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {i.authorityKind} · {i.openFindingCount} open / {i.findingCount}{" "}
                              findings
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {list.tab === "notifications" ? (
                <section>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Entered from the case; listed here. The system does not transmit.
                  </p>
                  {list.notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No notifications recorded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.notifications.map((n) => (
                        <li key={n.id} className="rounded-md border p-3 text-sm">
                          <p className="font-medium">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{n.state}</span>{" "}
                            {n.kind} · {n.recipientName}
                          </p>
                          <p className="mt-1 text-muted-foreground">{n.subject}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {n.channel}
                            {n.sentAt ? ` · sent ${n.sentAt}` : ""}
                            {n.sentByName ? ` · ${n.sentByName}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {list.tab === "disclosure" ? (
                <section>
                  {!readOnly ? (
                    <div className="mb-3">
                      <Button size="sm" onClick={() => setDiscloseOpen(true)}>
                        Open disclosure session
                      </Button>
                    </div>
                  ) : null}
                  {list.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No disclosure sessions.</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.sessions.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                        >
                          <div>
                            {s.audience} · {s.active ? "active" : "closed"} · expires{" "}
                            {s.expiresAt.slice(0, 16)}
                            <p className="text-xs text-muted-foreground">
                              Scope: {s.scope.join(", ") || "—"}
                            </p>
                          </div>
                          {s.active && !readOnly ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void list.closeDisclosure(s.id)}
                            >
                              Close
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </div>
          )}
        </ListPageShell>
      </main>

      <Dialog open={!!remediateTarget} onOpenChange={(o) => !o && setRemediateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark finding remediated</DialogTitle>
            <DialogDescription>
              Optional: record an Abhilfenachweis notification (does not transmit).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rem-note">Remediation note</Label>
              <Textarea id="rem-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rem-to">Notify recipient (optional)</Label>
              <Input
                id="rem-to"
                placeholder="e.g. Gesundheitsamt"
                value={notifyRecipient}
                onChange={(e) => setNotifyRecipient(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemediateTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void submitRemediate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discloseOpen} onOpenChange={setDiscloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open disclosure session</DialogTitle>
            <DialogDescription>
              Hard expiry. Inspector gets no account — you decide what is shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="disc-aud">Audience</Label>
              <Input
                id="disc-aud"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Gesundheitsamt Köln"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="disc-pur">Purpose (optional)</Label>
              <Input id="disc-pur" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="disc-exp">Expires at</Label>
              <Input
                id="disc-exp"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiscloseOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !audience.trim() || !expiresAt}
              onClick={() => void submitDisclosure()}
            >
              Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
