import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app - without it, Next.js infers the root
  // from the nearest lockfile it finds walking up, which lands on the outer
  // shift-seven repo (the old Vite app's package-lock.json) since /web isn't
  // an npm workspace of that project.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
