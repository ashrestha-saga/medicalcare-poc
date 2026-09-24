import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma's query engine must not be bundled by Next's server compiler.
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: ["aerosol-nemesis-essay.ngrok-free.dev"],
};

export default withNextIntl(nextConfig);
