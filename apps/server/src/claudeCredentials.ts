// FILE: claudeCredentials.ts
// Purpose: Load, refresh, and persist Claude Code OAuth credentials used by the SDK.
// Layer: Server runtime utility

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import nodePath from "node:path";

import {
  decodeJwtExpMs,
  refreshOAuthAccessToken,
} from "./providerUsage/credentials.ts";
import { fetchJson, isAuthFailureStatus } from "./providerUsage/http.ts";
import {
  asFiniteNumber,
  asRecord,
  asString,
} from "./providerUsage/parse.ts";

export const CLAUDE_OAUTH_REFRESH_URL = "https://platform.claude.com/v1/oauth/token";
export const CLAUDE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
export const CLAUDE_OAUTH_SCOPES =
  "user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";
export const CLAUDE_OAUTH_REFRESH_BUFFER_MS = 5 * 60 * 1000;
export const CLAUDE_OAUTH_USAGE_PROBE_URL = "https://api.anthropic.com/api/oauth/usage";

export interface ClaudeOAuthCreds {
  accessToken: string;
  refreshToken: string | undefined;
  expiresAtMs: number | undefined;
  subscriptionType: string | undefined;
  rateLimitTier: string | undefined;
  scopes: ReadonlyArray<string>;
}

export interface ClaudeCredentialSource {
  credentialsPath: string;
  creds: ClaudeOAuthCreds;
}

function readScopes(oauth: Record<string, unknown> | null): ReadonlyArray<string> {
  if (Array.isArray(oauth?.scopes)) {
    return oauth.scopes.filter((scope): scope is string => typeof scope === "string");
  }
  const scopeText = asString(oauth?.scope);
  return scopeText ? scopeText.split(/\s+/u).filter((scope) => scope.length > 0) : [];
}

export function readClaudeOAuthCreds(record: Record<string, unknown> | null): ClaudeOAuthCreds | null {
  const oauth = asRecord(record?.claudeAiOauth);
  const accessToken = asString(oauth?.accessToken);
  if (!accessToken) {
    return null;
  }
  return {
    accessToken,
    refreshToken: asString(oauth?.refreshToken),
    expiresAtMs: asFiniteNumber(oauth?.expiresAt),
    subscriptionType: asString(oauth?.subscriptionType),
    rateLimitTier: asString(oauth?.rateLimitTier),
    scopes: readScopes(oauth),
  };
}

export function resolveClaudeCredentialsPaths(input: {
  homeDir: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const paths: string[] = [];
  const configDir = input.env.CLAUDE_CONFIG_DIR?.trim();
  if (configDir) {
    paths.push(nodePath.join(configDir, ".credentials.json"));
  }
  paths.push(nodePath.join(input.homeDir, ".claude", ".credentials.json"));
  return [...new Set(paths)];
}

function readClaudeCredentialsFile(credentialsPath: string): ClaudeCredentialSource | null {
  try {
    const record = asRecord(JSON.parse(readFileSync(credentialsPath, "utf8")) as unknown);
    const creds = readClaudeOAuthCreds(record);
    if (!creds) {
      return null;
    }
    return { credentialsPath, creds };
  } catch {
    return null;
  }
}

export function resolveClaudeCredentialSources(input: {
  homeDir: string;
  env: NodeJS.ProcessEnv;
}): ClaudeCredentialSource[] {
  const sources: ClaudeCredentialSource[] = [];
  const seenPaths = new Set<string>();

  for (const credentialsPath of resolveClaudeCredentialsPaths(input)) {
    if (seenPaths.has(credentialsPath)) {
      continue;
    }
    seenPaths.add(credentialsPath);
    const source = readClaudeCredentialsFile(credentialsPath);
    if (source) {
      sources.push(source);
    }
  }

  return sources;
}

export function getClaudeOAuthExpiresAtMs(creds: ClaudeOAuthCreds): number | undefined {
  if (creds.expiresAtMs !== undefined) {
    return creds.expiresAtMs;
  }
  const jwtExpMs = decodeJwtExpMs(creds.accessToken);
  return jwtExpMs ?? undefined;
}

export function shouldRefreshClaudeOAuthCreds(creds: ClaudeOAuthCreds, nowMs: number): boolean {
  if (!creds.refreshToken) {
    return false;
  }
  const expiresAtMs = getClaudeOAuthExpiresAtMs(creds);
  if (expiresAtMs === undefined) {
    return false;
  }
  return expiresAtMs <= nowMs + CLAUDE_OAUTH_REFRESH_BUFFER_MS;
}

export function isClaudeOAuthAccessTokenLocallyExpired(
  creds: ClaudeOAuthCreds,
  nowMs: number,
): boolean {
  const expiresAtMs = getClaudeOAuthExpiresAtMs(creds);
  return expiresAtMs !== undefined && expiresAtMs <= nowMs;
}

export async function probeClaudeOAuthAccessToken(
  accessToken: string,
): Promise<"accepted" | "rejected" | "inconclusive"> {
  try {
    const result = await fetchJson({
      url: CLAUDE_OAUTH_USAGE_PROBE_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "claude-code/2.1.69",
      },
    });
    if (isAuthFailureStatus(result.status)) {
      return "rejected";
    }
    if (result.ok) {
      return "accepted";
    }
    return "inconclusive";
  } catch {
    return "inconclusive";
  }
}

export async function isClaudeOAuthAccessTokenAccepted(
  accessToken: string,
): Promise<boolean> {
  const probe = await probeClaudeOAuthAccessToken(accessToken);
  return probe === "accepted";
}

export async function isClaudeOAuthCredentialSourceValid(
  source: ClaudeCredentialSource,
  nowMs: number,
): Promise<boolean> {
  if (isClaudeOAuthAccessTokenLocallyExpired(source.creds, nowMs)) {
    return false;
  }
  const probe = await probeClaudeOAuthAccessToken(source.creds.accessToken);
  if (probe === "rejected") {
    return false;
  }
  return true;
}

export function preferClaudeOAuthOverApiKeyEnv(
  env: NodeJS.ProcessEnv,
  input: { homeDir: string },
): NodeJS.ProcessEnv {
  if (!env.ANTHROPIC_API_KEY?.trim()) {
    return env;
  }
  const sources = resolveClaudeCredentialSources({
    homeDir: input.homeDir,
    env,
  });
  if (sources.length === 0) {
    return env;
  }
  const next = { ...env };
  delete next.ANTHROPIC_API_KEY;
  return next;
}

function applyRefreshedClaudeOAuthCreds(
  creds: ClaudeOAuthCreds,
  refreshed: { accessToken: string; refreshToken?: string; expiresAtMs?: number },
): ClaudeOAuthCreds {
  return {
    ...creds,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? creds.refreshToken,
    expiresAtMs: refreshed.expiresAtMs ?? creds.expiresAtMs,
  };
}

export async function refreshClaudeOAuthCreds(
  creds: ClaudeOAuthCreds,
): Promise<ClaudeOAuthCreds | null> {
  if (!creds.refreshToken) {
    return null;
  }
  const refreshed = await refreshOAuthAccessToken({
    refreshUrl: CLAUDE_OAUTH_REFRESH_URL,
    refreshToken: creds.refreshToken,
    clientId: CLAUDE_OAUTH_CLIENT_ID,
    scope: CLAUDE_OAUTH_SCOPES,
  });
  return refreshed ? applyRefreshedClaudeOAuthCreds(creds, refreshed) : null;
}

export function persistClaudeOAuthCredentials(
  credentialsPath: string,
  creds: ClaudeOAuthCreds,
): void {
  mkdirSync(nodePath.dirname(credentialsPath), { recursive: true });
  const nextRecord = {
    claudeAiOauth: {
      accessToken: creds.accessToken,
      ...(creds.refreshToken ? { refreshToken: creds.refreshToken } : {}),
      ...(creds.expiresAtMs !== undefined ? { expiresAt: creds.expiresAtMs } : {}),
      ...(creds.subscriptionType ? { subscriptionType: creds.subscriptionType } : {}),
      ...(creds.rateLimitTier ? { rateLimitTier: creds.rateLimitTier } : {}),
      ...(creds.scopes.length > 0 ? { scopes: [...creds.scopes] } : {}),
    },
  };
  writeFileSync(credentialsPath, `${JSON.stringify(nextRecord, null, 2)}\n`, "utf8");
}

let pendingCredentialRefresh: Promise<boolean> | null = null;

async function refreshClaudeCredentialSource(
  source: ClaudeCredentialSource,
): Promise<{ source: ClaudeCredentialSource; refreshed: boolean }> {
  const refreshed = await refreshClaudeOAuthCreds(source.creds);
  if (!refreshed) {
    return { source, refreshed: false };
  }
  persistClaudeOAuthCredentials(source.credentialsPath, refreshed);
  return {
    source: { credentialsPath: source.credentialsPath, creds: refreshed },
    refreshed: true,
  };
}

async function refreshClaudeCredentialSources(input: {
  homeDir: string;
  env: NodeJS.ProcessEnv;
  nowMs: number;
}): Promise<boolean> {
  let refreshedAny = false;

  let sources = resolveClaudeCredentialSources(input);
  for (const source of sources) {
    if (!shouldRefreshClaudeOAuthCreds(source.creds, input.nowMs)) {
      continue;
    }
    const result = await refreshClaudeCredentialSource(source);
    if (result.refreshed) {
      refreshedAny = true;
    }
  }

  sources = resolveClaudeCredentialSources(input);
  const validated: Array<{ source: ClaudeCredentialSource; valid: boolean }> = [];
  for (const source of sources) {
    let activeSource = source;
    let valid = await isClaudeOAuthCredentialSourceValid(activeSource, input.nowMs);
    if (!valid && activeSource.creds.refreshToken) {
      const result = await refreshClaudeCredentialSource(activeSource);
      if (result.refreshed) {
        refreshedAny = true;
        activeSource = result.source;
        valid = await isClaudeOAuthCredentialSourceValid(activeSource, input.nowMs);
      }
    }
    validated.push({ source: activeSource, valid });
  }

  const bestValidSource = validated.find((entry) => entry.valid)?.source;
  if (bestValidSource) {
    for (const entry of validated) {
      if (entry.valid) {
        continue;
      }
      persistClaudeOAuthCredentials(entry.source.credentialsPath, bestValidSource.creds);
      refreshedAny = true;
    }
  }

  return refreshedAny;
}

export async function ensureClaudeCredentialsFresh(input: {
  homeDir: string;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
}): Promise<boolean> {
  const env = input.env ?? process.env;
  const nowMs = input.nowMs ?? Date.now();

  if (!pendingCredentialRefresh) {
    pendingCredentialRefresh = refreshClaudeCredentialSources({
      homeDir: input.homeDir,
      env,
      nowMs,
    }).finally(() => {
      pendingCredentialRefresh = null;
    });
  }

  return pendingCredentialRefresh;
}
