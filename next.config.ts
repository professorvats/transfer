import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@tus/server", "@tus/file-store"],
};

export default nextConfig;
