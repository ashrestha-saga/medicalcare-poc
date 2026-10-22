"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import type { AuthorityNotificationDTO, NotificationChannelDto, NotificationKindDto } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export type NotificationSubject =
  | { type: "incident"; id: string; defaultSubject?: string; defaultBody?: string }
  | { type: "finding"; id: string; defaultSubject?: string; defaultBody?: string }
  | { type: "device"; id: string; defaultSubject?: string; defaultBody?: string }
  | { type: "site"; id: string; defaultSubject?: string; defaultBody?: string };

const today = () => new Date().toISOString().slice(0, 10);

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function defaultKind(subject: NotificationSubject): NotificationKindDto {
  switch (subject.type) {
    case "incident":
      return "incident";
    case "finding":
      return "finding_remediation";
    case "device":
      return "radiation";
    case "site":
      return "radiation";
  }
}

function kindsFor(subject: NotificationSubject): NotificationKindDto[] {
  switch (subject.type) {
    case "incident":
      return ["incident"];
    case "finding":
      return ["finding_remediation"];
    case "device":
      return ["radiation", "metrology", "other"];
    case "site":
      return ["radiation", "accident", "metrology", "other"];
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: NotificationSubject | null;
  onRecorded?: (notification: AuthorityNotificationDTO) => void;
};

export function RecordNotificationModal({ open, onOpenChange, subject, onRecorded }: Props) {
  const t = useTranslations("pages.authorityNotification");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<NotificationKindDto>("incident");
  const [recipientName, setRecipientName] = useState("");
  const [channel, setChannel] = useState<NotificationChannelDto | "">("");
  const [subjectText, setSubjectText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sentAt, setSentAt] = useState(today);
  const [reference, setReference] = useState("");
  const [ackRef, setAckRef] = useState("");

  useEffect(() => {
    if (!open || !subject) return;
    setKind(defaultKind(subject));
    setRecipientName(subject.type === "incident" ? "BfArM" : "");
    setChannel(subject.type === "incident" ? "authority_portal" : "email");
    setSubjectText(subject.defaultSubject ?? "");
    setBodyText(subject.defaultBody ?? "");
    setSentAt(today());
    setReference("");
    setAckRef("");
  }, [open, subject]);

  if (!subject) return null;

  const kindOptions = kindsFor(subject);

  const submit = async () => {
    if (!recipientName.trim() || !channel || !subjectText.trim() || !sentAt) return;
    setBusy(true);
    try {
      const documents = ackRef.trim()
        ? [{ role: "acknowledgement" as const, externalRef: ackRef.trim() }]
        : undefined;
      const body = {
        kind,
        recipientName: recipientName.trim(),
        channel,
        subject: subjectText.trim(),
        bodyText: bodyText.trim() || null,
        sentAt,
        reference: reference.trim() || null,
        documents,
        incidentId: subject.type === "incident" ? subject.id : null,
        findingId: subject.type === "finding" ? subject.id : null,
        deviceInstanceId: subject.type === "device" ? subject.id : null,
        siteId: subject.type === "site" ? subject.id : null,
      };
      const res = await api<{ notification: AuthorityNotificationDTO }>(
        "/api/authority/notifications",
        { method: "POST", body: JSON.stringify(body) },
      );
      toast.success(t("saved"));
      onRecorded?.(res.notification);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errSave"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="record-notification-dialog">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {kindOptions.length > 1 ? (
            <div className="space-y-1">
              <Label htmlFor="notif-kind">{t("kind")}</Label>
              <select
                id="notif-kind"
                className={selectClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as NotificationKindDto)}
              >
                {kindOptions.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="notif-to">{t("recipient")}</Label>
            <Input
              id="notif-to"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={t("recipientPlaceholder")}
              data-testid="notif-recipient"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notif-ch">{t("channel")}</Label>
            <select
              id="notif-ch"
              className={selectClass}
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotificationChannelDto)}
              data-testid="notif-channel"
            >
              <option value="">{t("choose")}</option>
              <option value="authority_portal">{t("channels.authority_portal")}</option>
              <option value="manufacturer_portal">{t("channels.manufacturer_portal")}</option>
              <option value="email">{t("channels.email")}</option>
              <option value="post">{t("channels.post")}</option>
              <option value="fax">{t("channels.fax")}</option>
              <option value="other">{t("channels.other")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notif-subj">{t("subject")}</Label>
            <Input
              id="notif-subj"
              value={subjectText}
              onChange={(e) => setSubjectText(e.target.value)}
              data-testid="notif-subject"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notif-body">{t("body")}</Label>
            <Textarea
              id="notif-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="notif-sent">{t("sentAt")}</Label>
              <Input
                id="notif-sent"
                type="date"
                value={sentAt}
                onChange={(e) => setSentAt(e.target.value)}
                data-testid="notif-sent-at"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notif-ref">{t("reference")}</Label>
              <Input
                id="notif-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notif-ack">{t("ackRef")}</Label>
            <Input
              id="notif-ack"
              value={ackRef}
              onChange={(e) => setAckRef(e.target.value)}
              placeholder={t("ackRefPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("ackRefHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy || !recipientName.trim() || !channel || !subjectText.trim() || !sentAt}
            onClick={() => void submit()}
            data-testid="notif-save"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
