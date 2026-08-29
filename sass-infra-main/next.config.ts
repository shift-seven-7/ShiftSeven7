import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],

  // Tenant provisioning reads supabase/migrations/*.sql at runtime
  // (lib/constants/migrations.ts). Next's output tracing does not follow
  // readdirSync, so these routes would throw ENOENT on a deployed instance
  // without an explicit include.
  outputFileTracingIncludes: {
    "/api/admin/tenants/create-automated": ["./supabase/migrations/**"],
    "/api/admin/tenants/[id]/setup/run-step": ["./supabase/migrations/**"],
    "/api/bootstrap": ["./supabase/migrations/**"],
  },

  images: {
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Multi-tenant: allow any subdomain in development.
  // Example: acme.localhost:3000 -> the proxy reads "acme" off the Host header.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          has: [{ type: "host", value: "(?<tenant>[^.]+)\\.localhost" }],
          destination: "/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
