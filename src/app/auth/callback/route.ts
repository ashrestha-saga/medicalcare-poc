import { NextResponse } from "next/server";
import { errorMessage, logger } from "@/lib/logger";
import { shopAuthService } from "@/services/shop/shopAuthService";

/**
 * OAuth2 + PKCE redirect target — links shop to the tenant (admin Settings).
 * Does not create a DeviceCare login session.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    logger.warn("shop.tenant_connect.denied", { error });
    return NextResponse.redirect(new URL(`/settings?oxid=denied`, url.origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`/settings?oxid=invalid`, url.origin));
  }

  try {
    const { returnTo } = await shopAuthService.completeConnect({ code, state });
    const dest = new URL(returnTo || "/settings", url.origin);
    dest.searchParams.set("oxid", "connected");
    return NextResponse.redirect(dest);
  } catch (err) {
    logger.error("shop.tenant_connect.failed", { error: errorMessage(err) });
    return NextResponse.redirect(new URL(`/settings?oxid=failed`, url.origin));
  }
}
