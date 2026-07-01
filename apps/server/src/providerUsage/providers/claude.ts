// FILE: providerUsage/providers/claude.ts
// Purpose: Live Claude (Anthropic) usage fetcher. Reads the Claude Code OAuth token from
// ~/.claude/.credentials.json or the macOS keychain ("Claude Code-credentials", possibly
// hex-encoded) read-only, and calls the OAuth usage endpoint, mapping the 5h/weekly/sonnet
// utilization windows + extra-usage credits. Reference: openusage plugins/claude/plugin.js.

import type {
  ServerProviderUsageLimit,
  ServerProviderUsageLine,
  ServerProviderUsageSnapshot,
} from "@t3tools/contracts";

import {
  ensureClaudeCredentialsFresh,
  readClaudeOAuthCreds,
  refreshClaudeOAuthCreds,
  resolveClaudeCredentialsPaths,
  shouldRefreshClaudeOAuthCreds,
  type ClaudeOAuthCreds,
} from "../../claudeCredentials.ts";
import {
  decodeKeychainJson,
  readJsonFile,
  readKeychainPassword,
} from "../credentials";
import { fetchJson, isAuthFailureStatus } from "../http";
import {
  asFiniteNumber,
  asRecord,
  asString,
  buildSnapshot,
  clampPercent,
  errorSnapshot,
  formatUsd,
  isoFromString,
  needsAuthSnapshot,
  titleCase,
} from "../parse";
import type { ProviderUsageContext, ProviderUsageFetcher } from "../types";

const SOURCE = "claude-oauth-usage";
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const KEYCHAIN_SERVICE = "Claude Code-credentials";

function hasProfileScope(creds: ClaudeOAuthCreds): boolean {
  return creds.scopes.length === 0 || creds.scopes.includes("user:profile");
}

function claudePlanName(creds: ClaudeOAuthCreds): string | undefined {
  if (!creds.subscriptionType) {
    return undefined;
  }
  let name = titleCase(creds.subscriptionType);
  const tier = creds.rateLimitTier?.match(/(\d+x)/iu)?.[1];
  if (tier) {
    name += ` (${tier.toLowerCase()})`;
  }
  return name;
}

async function resolveClaudeCredCandidates(ctx: ProviderUsageContext): Promise<ClaudeOAuthCreds[]> {
  await ensureClaudeCredentialsFresh({
    homeDir: ctx.homeDir,
    env: ctx.env,
    nowMs: ctx.nowMs,
  });

  const candidates: ClaudeOAuthCreds[] = [];
  for (const credentialsPath of resolveClaudeCredentialsPaths({
    homeDir: ctx.homeDir,
    env: ctx.env,
  })) {
    const record = asRecord(await readJsonFile(credentialsPath));
    const creds = readClaudeOAuthCreds(record);
    if (creds) {
      candidates.push(creds);
    }
  }

  const keychainAccount = asString(ctx.env.USER) ?? asString(ctx.env.LOGNAME);
  const keychain =
    keychainAccount !== undefined
      ? await readKeychainPassword({
          service: KEYCHAIN_SERVICE,
          account: keychainAccount,
          platform: ctx.platform,
        })
      : null;
  const keychainFallback =
    keychain ??
    (await readKeychainPassword({
      service: KEYCHAIN_SERVICE,
      platform: ctx.platform,
    }));
  if (keychainFallback) {
    const creds = readClaudeOAuthCreds(asRecord(decodeKeychainJson(keychainFallback)));
    if (creds) {
      candidates.push(creds);
    }
  }
  return candidates;
}

export function parseClaudeUsage(input: { json: unknown; nowMs: number; planName?: string }) {
  const root = asRecord(input.json);
  const limits: ServerProviderUsageLimit[] = [];
  const usageLines: ServerProviderUsageLine[] = [];

  const pushWindow = (label: string, windowValue: unknown, windowDurationMins: number): void => {
    const window = asRecord(windowValue);
    if (!window) {
      return;
    }
    const usedPercent = clampPercent(asFiniteNumber(window.utilization));
    const resetsAt = isoFromString(window.resets_at);
    if (usedPercent === undefined && !resetsAt) {
      return;
    }
    limits.push({
      window: label,
      ...(usedPercent !== undefined ? { usedPercent } : {}),
      ...(resetsAt ? { resetsAt } : {}),
      windowDurationMins,
    });
  };

  pushWindow("5h", root?.five_hour, 300);
  pushWindow("Weekly", root?.seven_day, 10_080);
  pushWindow("Sonnet", root?.seven_day_sonnet, 10_080);
  pushWindow("Opus", root?.seven_day_opus, 10_080);

  const extra = asRecord(root?.extra_usage);
  if (extra && extra.is_enabled !== false) {
    const usedCredits = asFiniteNumber(extra.used_credits);
    const monthlyLimit = asFiniteNumber(extra.monthly_limit);
    if (usedCredits !== undefined) {
      const usedUsd = formatUsd(usedCredits / 100);
      const value =
        monthlyLimit && monthlyLimit > 0
          ? `${usedUsd} of ${formatUsd(monthlyLimit / 100)}`
          : `${usedUsd} spent`;
      usageLines.push({ label: "Extra usage", value });
    }
  }

  return buildSnapshot({
    provider: "claudeAgent",
    nowMs: input.nowMs,
    status: "ok",
    source: SOURCE,
    limits,
    usageLines,
    ...(input.planName ? { planName: input.planName } : {}),
  });
}

export const claudeUsageFetcher: ProviderUsageFetcher = {
  provider: "claudeAgent",
  async fetch(ctx) {
    const candidates = await resolveClaudeCredCandidates(ctx);
    if (candidates.length === 0) {
      return needsAuthSnapshot("claudeAgent", ctx.nowMs, SOURCE);
    }

    let inferenceOnlySnapshot: ReturnType<typeof buildSnapshot> | null = null;
    let lastErrorSnapshot: ServerProviderUsageSnapshot | null = null;

    for (const creds of candidates) {
      if (!hasProfileScope(creds)) {
        const planName = claudePlanName(creds);
        inferenceOnlySnapshot = buildSnapshot({
          provider: "claudeAgent",
          nowMs: ctx.nowMs,
          status: "ok",
          source: SOURCE,
          ...(planName ? { planName } : {}),
        });
        continue;
      }

      let activeCreds = creds;
      if (shouldRefreshClaudeOAuthCreds(activeCreds, ctx.nowMs)) {
        const refreshed = await refreshClaudeOAuthCreds(activeCreds);
        if (refreshed) {
          activeCreds = refreshed;
        } else if (activeCreds.expiresAtMs !== undefined && activeCreds.expiresAtMs <= ctx.nowMs) {
          continue;
        }
      }

      try {
        let result = await fetchClaudeUsage(activeCreds.accessToken);
        if (isAuthFailureStatus(result.status) && activeCreds.refreshToken) {
          const refreshed = await refreshClaudeOAuthCreds(activeCreds);
          if (refreshed) {
            activeCreds = refreshed;
            result = await fetchClaudeUsage(activeCreds.accessToken);
          }
        }
        if (isAuthFailureStatus(result.status)) {
          continue;
        }
        if (!result.ok) {
          lastErrorSnapshot = errorSnapshot(
            "claudeAgent",
            ctx.nowMs,
            SOURCE,
            `Claude usage request failed (${result.status}).`,
          );
          continue;
        }
        const planName = claudePlanName(activeCreds);
        return parseClaudeUsage({
          json: result.json,
          nowMs: ctx.nowMs,
          ...(planName ? { planName } : {}),
        });
      } catch {
        lastErrorSnapshot = errorSnapshot(
          "claudeAgent",
          ctx.nowMs,
          SOURCE,
          "Could not reach the Claude usage endpoint.",
        );
        continue;
      }
    }

    return (
      inferenceOnlySnapshot ??
      lastErrorSnapshot ??
      needsAuthSnapshot("claudeAgent", ctx.nowMs, SOURCE)
    );
  },
};

function fetchClaudeUsage(accessToken: string) {
  return fetchJson({
    url: USAGE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": "claude-code/2.1.69",
    },
  });
}
