import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/** Section 44 — health/readiness. Database reachability is the only hard dependency. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      database: "up",
      adapters: { oxid: env.oxid.adapterMode, beudamed: env.beudamed.adapterMode },
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json({ status: "degraded", database: "down" }, { status: 503 });
  }
}
