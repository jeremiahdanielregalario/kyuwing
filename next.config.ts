import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "pdf-lib"],
  experimental: {
    agentUpgrade: "security",
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
