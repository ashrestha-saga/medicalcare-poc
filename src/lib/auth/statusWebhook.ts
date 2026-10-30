import { env } from "@/lib/env";
import { hmacHex, safeEqual } from "@/lib/crypto";
import { unauthorized } from "@/lib/errors";

/**
 * Shared-secret HMAC over the raw request body.
 * Header: `X-DeviceCare-Signature: sha256=<hex>`.
 */
export function assertStatusWebhook(rawBody: string, signatureHeader: string | null): void {
  const secret = env.statusWebhook.secret;
  if (!secret) {
    throw unauthorized("STATUS_WEBHOOK_SECRET is not configured.");
  }
  const provided = signatureHeader?.replace(/^sha256=/i, "").trim() ?? "";
  const expected = hmacHex(secret, rawBody);
  if (!provided || !safeEqual(provided, expected)) {
    throw unauthorized("Invalid status signature.");
  }
}
