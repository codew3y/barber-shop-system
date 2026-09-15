import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
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
