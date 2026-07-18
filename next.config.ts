import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Turbopack/webpack not to bundle native Node packages
  serverExternalPackages: ["esbuild", "playwright", "playwright-core"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
