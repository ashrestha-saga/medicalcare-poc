/**
 * Runs before every test file. Points Prisma at an isolated SQLite file so
 * integration tests never touch dev.db. The file itself is prepared by
 * tests/globalSetup.ts.
 */
process.env.DATABASE_URL = "file:./test.db";
// Next's ambient types declare NODE_ENV readonly; vitest sets it to "test" itself.
Object.assign(process.env, { NODE_ENV: "test" });
process.env.SESSION_SECRET = "test-secret";
process.env.OXID_ADAPTER_MODE = "mock";
process.env.BEUDAMED_ADAPTER_MODE = "stub";
process.env.BEUDAMED_CACHE_TTL_DAYS = "90";
process.env.BEUDAMED_TIMEOUT_MS = "300";
process.env.SMTP_DISABLE = "true";
