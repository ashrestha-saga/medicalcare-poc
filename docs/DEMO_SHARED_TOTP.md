# DEMO_SHARED_TOTP — demo showcase authenticator bridge

**Status:** demo / showcase hosting. Opt-in via env (works in `next dev` **and** production `next start` when enabled). Disable before real end users.

One Authenticator account unlocks **every clinic and partner user who has not enrolled personal 2FA**. After a clinic user completes setup on `/security`, only their personal secret is accepted. Partner door uses the same shared secret while the bridge is on (no partner personal-2FA UI today).

---

## Setup (presenter)

1. Set env (`.env.local` for local, or your host’s env / `.env.production.local` for the demo server):

```bash
DEMO_SHARED_TOTP_ENABLED=true
# Generate once: node -e "console.log(require('otplib').generateSecret())"
DEMO_SHARED_TOTP_SECRET=<base32-secret>
DEMO_SHARED_TOTP_ISSUER="DeviceCare Demo"
# Strongly recommended on a public demo host:
# DEMO_BRIDGE_PASS=your-passphrase
```

2. Restart the app (`npm run dev`, or redeploy / restart `npm run start`).

3. Open **`/demo/auth-bridge`** on that host  
   (add `?pass=…` if `DEMO_BRIDGE_PASS` is set).

4. Scan the QR into your phone Authenticator **once** (same secret on every environment you enable).

5. Sign-in:
   - **Clinic** (`/login`): password → shared 6-digit code for users still on the bridge.
   - **Partner** (`/login/partner`): same shared code after password.
   - Clinic users with personal 2FA use their own authenticator entry.

---

## Behaviour

| User | After password |
|------|----------------|
| No personal 2FA (`totpEnabled` false / no secret) | Challenge verified against `DEMO_SHARED_TOTP_SECRET` (clinic **and** partner doors) |
| Personal 2FA enabled via `/security` (clinic) | Challenge verified against **their** secret only (shared ignored) |

Bridge is **off** when any of: `NODE_ENV=test`, `DEMO_SHARED_TOTP_ENABLED` ≠ `true`, or secret empty.  
It **can** run with `NODE_ENV=production` if the two env vars above are set (hosted demo).

---

## Files to remove (easy uninstall)

Search the repo for the marker string **`DEMO_SHARED_TOTP`**.

| Path | Role |
|------|------|
| `docs/DEMO_SHARED_TOTP.md` | This doc |
| `src/lib/demo/sharedTotp.ts` | Feature flag + verify helpers |
| `src/lib/demo/sharedTotp.test.ts` | Unit tests |
| `src/app/(auth)/demo/auth-bridge/page.tsx` | Secret UI route |
| `src/components/features/demo/DemoTotpBridgeScreen.tsx` | Bridge UI |
| `src/app/api/demo/totp-bridge/route.ts` | QR + roster API |
| `src/lib/env.ts` → `demoSharedTotp` | Env accessors |
| `.env.example` | Commented env vars |
| `docs/PROJECT.md` | One-line pointer under Configuration |

**Touch-ups (revert DEMO_SHARED_TOTP comments / imports):**

| Path | Change to undo |
|------|----------------|
| `src/services/auth/userAuthService.ts` | Remove `clinicLoginRequires2fa` import; restore clinic-only `totpEnabled`; drop partner `totpEnabled` |
| `src/services/auth/totpService.ts` | Remove shared-bridge / partner branch in `verifyLoginChallenge` |
| `src/app/api/auth/login/route.ts` | Remove partner 2FA challenge + DEMO_SHARED_TOTP comments |
| `src/app/api/auth/2fa/verify/route.ts` | Restore clinic-only homePath |

Then delete env keys from `.env.local` and restart.

---

## Security notes

- Shared secret must **not** live in `NEXT_PUBLIC_*` (would ship to the browser bundle). The bridge page loads it only from the gated API while the feature is on.
- Opt-in only: without `DEMO_SHARED_TOTP_ENABLED=true` + secret, nothing runs (including production).
- Do not commit real `DEMO_SHARED_TOTP_SECRET` values.
- On a public demo host, set `DEMO_BRIDGE_PASS` so `/demo/auth-bridge` is not open to strangers.
- Turn the flag off (or remove this feature) before real customers use the system.
