import nodemailer from "nodemailer";
import type { DispatchAdapter, DispatchResult, DispatchTargetDTO } from "@/interfaces";
import { env } from "@/lib/env";
import { errorMessage, logger } from "@/lib/logger";
import { parseSmtpAuth, type SmtpAuthConfig } from "@/lib/smtp";
import { loadMailAttachments } from "@/services/dispatch/mailAttachments";

function resolveSmtp(target: DispatchTargetDTO): SmtpAuthConfig | null {
  return parseSmtpAuth(target.auth) ?? env.smtp.asAuth;
}

/**
 * Mail dispatch target.
 * Uses per-tenant SMTP from DispatchTarget.auth when present, else env SMTP_*.
 * Recipient (An:) is target.endpoint. Subject/body come from the formatted export.
 * Photos from the service request are attached when present.
 */
export const mailDispatchAdapter: DispatchAdapter = {
  type: "mail",
  async dispatch(target, payload): Promise<DispatchResult> {
    const to = target.endpoint?.trim() || payload.email.to;
    if (!to) {
      return { success: false, error: "mail target has no recipient" };
    }
    const { subject, body, html } = payload.email;
    const smtp = resolveSmtp(target);
    const attachments = await loadMailAttachments(payload.request.id, payload.tenantId);
    const text =
      attachments.length > 0
        ? `${body}\n\nFotos: ${attachments.length} Datei(en) als Anhang`
        : body;
    const htmlWithPhotos =
      attachments.length > 0
        ? html.replace(
            "Please use the information above when processing this service request.",
            `Photos (${attachments.length}) are attached to this email. Please use the information above when processing this service request.`,
          )
        : html;

    logger.info("dispatch.mail", {
      correlationId: payload.correlationId,
      to,
      subject,
      reference: payload.request.reference,
      smtpHost: smtp?.host ?? null,
      attachmentCount: attachments.length,
      simulated: !smtp || env.smtp.disabled,
    });

    if (!smtp || env.smtp.disabled) {
      return {
        success: true,
        response: {
          to,
          subject,
          body: text,
          html: htmlWithPhotos,
          attachmentCount: attachments.length,
          simulated: true,
          reason: !smtp ? "no_smtp_config" : "smtp_disabled",
        },
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      const info = await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html: htmlWithPhotos,
        attachments,
      });
      return {
        success: true,
        response: {
          to,
          subject,
          from: smtp.from,
          messageId: info.messageId ?? null,
          attachmentCount: attachments.length,
          simulated: false,
        },
      };
    } catch (error) {
      logger.warn("dispatch.mail.failed", {
        correlationId: payload.correlationId,
        to,
        error: errorMessage(error),
      });
      return {
        success: false,
        error: errorMessage(error),
        response: { to, subject, attachmentCount: attachments.length, simulated: false },
      };
    }
  },
};

/** Generic webhook adapter — POSTs the canonical export body to `target.endpoint`. */
export const webhookDispatchAdapter: DispatchAdapter = {
  type: "webhook",
  async dispatch(target, payload): Promise<DispatchResult> {
    if (!target.endpoint) return { success: false, error: "webhook target has no endpoint" };
    if (target.endpoint.startsWith("mock://")) {
      return target.endpoint === "mock://ok"
        ? { success: true, httpStatus: 200, response: { mock: true, body: payload.exportBody } }
        : { success: false, httpStatus: 500, error: `mock webhook failure (${target.endpoint})` };
    }
    const { fetchWithTimeout } = await import("@/lib/http");
    try {
      const res = await fetchWithTimeout(target.endpoint, {
        method: "POST",
        timeoutMs: 5000,
        headers: { "content-type": "application/json", "x-correlation-id": payload.correlationId },
        body: JSON.stringify(payload.exportBody),
      });
      return { success: res.ok, httpStatus: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
