import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
};

export default withSentryConfig(nextConfig, {
  // Skip sourcemap upload when no DSN is configured (local dev).
  sourcemaps: {
    disable: !process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  silent: true,
});
