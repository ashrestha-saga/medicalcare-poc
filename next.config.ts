import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma's query engine must not be bundled by Next's server compiler.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
