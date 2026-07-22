import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@basketball-sim/shared", "@basketball-sim/db", "@basketball-sim/sim"],
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
