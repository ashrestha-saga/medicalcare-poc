/**
 * DEMO_SHARED_TOTP — GET /api/demo/totp-bridge
 * QR + user roster for the shared authenticator (opt-in demo). See docs/DEMO_SHARED_TOTP.md.
 */

import { errorResponse, forbidden, notFound } from "@/lib/errors";
import {
  clinicUserUsesPersonalTotp,
  demoBridgePassOk,
  demoSharedTotpSecret,
  demoSharedTotpUri,
  isDemoSharedTotpActive,
} from "@/lib/demo/sharedTotp";
import { prisma } from "@/lib/prisma";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import QRCode from "qrcode";

/** GET /api/demo/totp-bridge?pass=… */
export async function GET(req: Request) {
  try {
    if (!isDemoSharedTotpActive()) throw notFound();

    const url = new URL(req.url);
    const pass =
      url.searchParams.get("pass") ??
      req.headers.get("x-demo-bridge-pass")?.trim() ??
      null;
    if (!demoBridgePassOk(pass)) throw forbidden();

    const secret = demoSharedTotpSecret();
    const otpauthUrl = demoSharedTotpUri();
    if (!secret || !otpauthUrl) throw notFound();

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });

    const users = await runWithoutTenantAsync(async () =>
      prisma.user.findMany({
        where: {
          active: true,
          anonymisedAt: null,
          accountKind: { in: ["clinic", "partner"] },
        },
        select: {
          id: true,
          email: true,
          name: true,
          accountKind: true,
          totpEnabled: true,
          totpSecretEnc: true,
          tenant: { select: { name: true, code: true } },
          orgMemberships: {
            where: {
              validFrom: { lte: new Date() },
              OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
            },
            take: 1,
            orderBy: { validFrom: "asc" },
            select: { organisation: { select: { name: true } } },
          },
        },
        orderBy: [{ accountKind: "asc" }, { email: "asc" }],
        take: 300,
      }),
    );

    const roster = users.map((u) => {
      const personal = clinicUserUsesPersonalTotp(u);
      const orgName = u.orgMemberships[0]?.organisation?.name ?? null;
      return {
        email: u.email,
        name: u.name,
        accountKind: u.accountKind === "partner" ? ("partner" as const) : ("clinic" as const),
        tenantName: u.accountKind === "partner" ? orgName : (u.tenant?.name ?? null),
        tenantCode: u.tenant?.code ?? null,
        mode: personal ? ("personal" as const) : ("shared" as const),
      };
    });

    return Response.json({
      enabled: true,
      issuer: otpauthUrl.includes("issuer=")
        ? decodeURIComponent(otpauthUrl.split("issuer=")[1]?.split("&")[0] ?? "")
        : "DeviceCare Demo",
      otpauthUrl,
      qrDataUrl,
      /** Presenter scans this once — never expose in production builds. */
      secret,
      roster,
      sharedCount: roster.filter((r) => r.mode === "shared").length,
      personalCount: roster.filter((r) => r.mode === "personal").length,
      clinicCount: roster.filter((r) => r.accountKind === "clinic").length,
      partnerCount: roster.filter((r) => r.accountKind === "partner").length,
      path: "/demo/auth-bridge",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
