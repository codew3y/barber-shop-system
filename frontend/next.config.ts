import path from "path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// The app lives in frontend/ but shares one .env and one node_modules with
// backend/ at the repo root. Load the root .env (Next only reads its own
// directory), and let Turbopack and output tracing see the whole monorepo so
// the backend package and the Prisma engine are bundled into each function.
const repoRoot = path.join(__dirname, "..");
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default withSentryConfig(nextConfig, {
  // Only upload sourcemaps when an auth token is configured (prod with
  // SENTRY_AUTH_TOKEN). Without it the upload step fails the build, so
  // local dev and token-less environments skip it and still report errors
  // via the DSN at runtime.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  silent: true,
});
