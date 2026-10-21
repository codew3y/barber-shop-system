#!/usr/bin/env node
/**
 * Run a command with the repo-root .env loaded into the real environment.
 *
 * frontend/next.config.ts already calls loadEnvConfig(repoRoot) so the app
 * can share one .env across both workspaces, but that only populates the
 * process evaluating the config. `next build` fans static generation out to
 * worker processes that do not see it, so a local build died with
 * "Environment variable not found: DATABASE_URL" while CI and Vercel were
 * fine — they inject real environment variables, so nothing had to be loaded.
 *
 * Loading here, before the child is spawned, puts the values in the actual
 * process environment that every descendant inherits. Where no .env exists
 * (CI, Vercel) this is a no-op and the injected variables are used as-is.
 *
 * Uses @next/env rather than dotenv so precedence matches what Next itself
 * applies (.env.local, .env.<mode>, .env).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @next/env is CommonJS, so it has no ESM named exports — take the default
// and destructure rather than importing { loadEnvConfig } directly.
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('usage: node scripts/with-env.mjs <command> [args...]');
  process.exit(1);
}

// `next dev` needs this as much as build does — Turbopack renders server
// components in a context that next.config.ts's loadEnvConfig never reaches,
// so a dev page querying the database died with "Environment variable not
// found: DATABASE_URL". dev mode is detected from the command so .env.development
// precedence matches what Next would apply itself.
const isDev = args.includes('dev');
loadEnvConfig(repoRoot, isDev);

// Windows: npm resolves to npm.cmd, and Node refuses to spawn a .cmd without
// a shell. Passing an args array alongside shell:true triggers DEP0190, so the
// whole command goes through as one string instead. The command comes from
// this repo's package.json scripts, never from user input.
// Everywhere else, spawn directly with no shell.
const isWindows = process.platform === 'win32';
const child = isWindows
  ? spawn([command, ...args].join(' '), { stdio: 'inherit', shell: true, env: process.env })
  : spawn(command, args, { stdio: 'inherit', env: process.env });

child.on('error', (err) => {
  console.error(`with-env: failed to start "${command}":`, err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  // Re-raise the signal so Ctrl-C and CI cancellation behave normally.
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
