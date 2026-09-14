import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory (outside this project) made Next
  // guess the workspace root incorrectly — pin it explicitly.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
