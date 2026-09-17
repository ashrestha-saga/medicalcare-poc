/**
 * Runs before every test file. Points Prisma at MySQL (TEST_DATABASE_URL if
 * set, otherwise DATABASE_URL from .env). Prefer a dedicated test database so
 * `npm test` does not wipe local app data.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../.env") });

const testUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testUrl || !testUrl.startsWith("mysql")) {
  throw new Error(
    "Tests require a MySQL DATABASE_URL (or TEST_DATABASE_URL). Set it in .env.",
  );
}
process.env.DATABASE_URL = testUrl;

Object.assign(process.env, { NODE_ENV: "test" });
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
process.env.OXID_ADAPTER_MODE = "mock";
process.env.BEUDAMED_ADAPTER_MODE = "stub";
process.env.BEUDAMED_CACHE_TTL_DAYS = "90";
process.env.BEUDAMED_TIMEOUT_MS = "300";
process.env.SMTP_DISABLE = "true";
