/**
 * SMTP settings stored on DispatchTarget.auth (JSON) per tenant,
 * or as a global fallback via env.
 */
export interface SmtpAuthConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function parseSmtpAuth(auth: Record<string, unknown> | null | undefined): SmtpAuthConfig | null {
  if (!auth) return null;
  const host = typeof auth.host === "string" ? auth.host.trim() : "";
  const user = typeof auth.user === "string" ? auth.user.trim() : "";
  const pass = typeof auth.pass === "string" ? auth.pass : "";
  const from = typeof auth.from === "string" ? auth.from.trim() : "";
  const portRaw = auth.port;
  const port = typeof portRaw === "number" ? portRaw : Number(portRaw);
  if (!host || !user || !pass || !from || !Number.isFinite(port) || port <= 0) return null;
  const secure =
    auth.secure === true || auth.secure === "true" || auth.secure === 1 || auth.secure === "1";
  return { host, port, secure, user, pass, from };
}
