// FILE: claudeProcessEnv.ts
// Purpose: Builds the environment passed to Claude Agent SDK sessions.
// Layer: Server runtime utility

import {
  readEnvironmentFromLoginShell,
  resolveLoginShell,
  type ShellEnvironmentReader,
} from "@t3tools/shared/shell";

import {
  ensureClaudeCredentialsFresh,
  preferClaudeOAuthOverApiKeyEnv,
} from "./claudeCredentials.ts";

const CLAUDE_PROCESS_SHELL_ENV_NAMES = [
  "PATH",
  "SSH_AUTH_SOCK",
  "CLAUDE_CONFIG_DIR",
  "ANTHROPIC_API_KEY",
] as const;

export function buildClaudeProcessEnv(
  input: {
    readonly env?: NodeJS.ProcessEnv;
    readonly homeDir?: string;
    readonly platform?: NodeJS.Platform;
    readonly readEnvironment?: ShellEnvironmentReader;
  } = {},
): NodeJS.ProcessEnv {
  const effectiveEnv = { ...(input.env ?? process.env) };
  const platform = input.platform ?? process.platform;

  if (platform === "darwin" || platform === "linux") {
    try {
      const shell = resolveLoginShell(platform, effectiveEnv.SHELL);
      if (shell) {
        const shellEnvironment = (input.readEnvironment ?? readEnvironmentFromLoginShell)(
          shell,
          [...CLAUDE_PROCESS_SHELL_ENV_NAMES],
        );

        if (shellEnvironment.PATH) {
          effectiveEnv.PATH = shellEnvironment.PATH;
        }
        if (!effectiveEnv.SSH_AUTH_SOCK && shellEnvironment.SSH_AUTH_SOCK) {
          effectiveEnv.SSH_AUTH_SOCK = shellEnvironment.SSH_AUTH_SOCK;
        }
        for (const name of ["CLAUDE_CONFIG_DIR", "ANTHROPIC_API_KEY"] as const) {
          if (!effectiveEnv[name]?.trim() && shellEnvironment[name]) {
            effectiveEnv[name] = shellEnvironment[name];
          }
        }
      }
    } catch {
      // Keep inherited environment if shell lookup fails.
    }
  }

  return effectiveEnv;
}

export async function prepareClaudeRuntimeEnvironment(input: {
  homeDir: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): Promise<NodeJS.ProcessEnv> {
  const env = buildClaudeProcessEnv({
    ...(input.env ? { env: input.env } : {}),
    homeDir: input.homeDir,
    ...(input.platform ? { platform: input.platform } : {}),
  });
  await ensureClaudeCredentialsFresh({
    homeDir: input.homeDir,
    env,
  });
  return preferClaudeOAuthOverApiKeyEnv(env, { homeDir: input.homeDir });
}
