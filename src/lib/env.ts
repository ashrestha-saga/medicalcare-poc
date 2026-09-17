/**
 * Server-only environment access. Every reader fails closed: a missing value
 * yields a safe default or `undefined`, never a thrown error that could bubble
 * to the client (Section 5).
 */

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  session: {
    get secret() {
      return str("SESSION_SECRET", "insecure-dev-session-secret");
    },
  },
  totp: {
    /** AES-256 key material for encrypting TOTP secrets (falls back to SESSION_SECRET). */
    get encryptionKey() {
      return str("TOTP_ENCRYPTION_KEY", str("SESSION_SECRET", "insecure-dev-session-secret"));
    },
    get issuer() {
      return str("TOTP_ISSUER", "DeviceCare");
    },
  },
  oxid: {
    get clientId() {
      return str("OXID_CLIENT_ID");
    },
    get clientSecret() {
      return str("OXID_CLIENT_SECRET");
    },
    get authorizeUrl() {
      return str("OXID_AUTHORIZE_URL");
    },
    get tokenUrl() {
      return str("OXID_TOKEN_URL");
    },
    get apiBaseUrl() {
      return str("OXID_API_BASE_URL");
    },
    get redirectUri() {
      return str("OXID_REDIRECT_URI", "http://localhost:3000/auth/callback");
    },
    get scope() {
      return str("OXID_SCOPE", "profile address api");
    },
    /** "mock" | "http" */
    get adapterMode() {
      return str("OXID_ADAPTER_MODE", "mock");
    },
    get configured() {
      return Boolean(this.clientId && this.authorizeUrl && this.tokenUrl);
    },
  },
  beudamed: {
    get apiBaseUrl() {
      return str("BEUDAMED_API_BASE_URL");
    },
    get apiKey() {
      return str("BEUDAMED_API_KEY");
    },
    get cacheTtlDays() {
      return int("BEUDAMED_CACHE_TTL_DAYS", 90);
    },
    get timeoutMs() {
      return int("BEUDAMED_TIMEOUT_MS", 2000);
    },
    get rateLimitPerIdentifierPerHour() {
      return int("BEUDAMED_RATE_LIMIT_PER_IDENTIFIER_PER_HOUR", 1);
    },
    get rateLimitPerTenantPerDay() {
      return int("BEUDAMED_RATE_LIMIT_PER_TENANT_PER_DAY", 200);
    },
    /** "stub" | "mock" | "http" */
    get adapterMode() {
      return str("BEUDAMED_ADAPTER_MODE", "stub");
    },
  },
  /**
   * Optional platform-wide SMTP fallback when a mail DispatchTarget has no auth JSON.
   * Prefer per-tenant settings on DispatchTarget.auth.
   */
  smtp: {
    get host() {
      return str("SMTP_HOST");
    },
    get port() {
      return int("SMTP_PORT", 587);
    },
    get secure() {
      return str("SMTP_SECURE", "false") === "true";
    },
    get user() {
      return str("SMTP_USER");
    },
    get pass() {
      return str("SMTP_PASS");
    },
    get from() {
      return str("SMTP_FROM");
    },
    /** When true, never open a real SMTP connection (tests / local dry-run). */
    get disabled() {
      return str("SMTP_DISABLE", "false") === "true" || (process.env.NODE_ENV ?? "") === "test";
    },
    get configured() {
      return Boolean(this.host && this.user && this.pass && this.from);
    },
    get asAuth() {
      if (!this.configured) return null;
      return {
        host: this.host,
        port: this.port,
        secure: this.secure,
        user: this.user,
        pass: this.pass,
        from: this.from,
      };
    },
  },
};
