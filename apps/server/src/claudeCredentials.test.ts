import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import nodePath from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensureClaudeCredentialsFresh,
  getClaudeOAuthExpiresAtMs,
  isClaudeOAuthAccessTokenAccepted,
  isClaudeOAuthCredentialSourceValid,
  persistClaudeOAuthCredentials,
  preferClaudeOAuthOverApiKeyEnv,
  shouldRefreshClaudeOAuthCreds,
} from "./claudeCredentials";

const NOW_MS = 1_780_000_000_000;
const tempDirs: string[] = [];

function makeClaudeHome(creds: Record<string, unknown>) {
  const homeDir = mkdtempSync(nodePath.join(os.tmpdir(), "synara-claude-creds-"));
  tempDirs.push(homeDir);
  const claudeDir = nodePath.join(homeDir, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  const credentialsPath = nodePath.join(claudeDir, ".credentials.json");
  writeFileSync(credentialsPath, JSON.stringify({ claudeAiOauth: creds }), "utf8");
  return { homeDir, credentialsPath };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("ensureClaudeCredentialsFresh", () => {
  it("persists refreshed OAuth credentials to the Claude credentials file", async () => {
    const originalExpiresAt = NOW_MS - 60_000;
    const { homeDir, credentialsPath } = makeClaudeHome({
      accessToken: "expired-access-token",
      refreshToken: "old-refresh-token",
      expiresAt: originalExpiresAt,
      scopes: ["user:profile"],
      subscriptionType: "pro",
    });

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("/oauth/token")) {
        return new Response(
          JSON.stringify({
            access_token: "fresh-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ five_hour: { utilization: 12 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const refreshed = await ensureClaudeCredentialsFresh({
      homeDir,
      env: {},
      nowMs: NOW_MS,
    });

    expect(refreshed).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const saved = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
      claudeAiOauth: Record<string, unknown>;
    };
    expect(saved.claudeAiOauth.accessToken).toBe("fresh-access-token");
    expect(saved.claudeAiOauth.refreshToken).toBe("new-refresh-token");
    expect(saved.claudeAiOauth.expiresAt).toBeGreaterThan(NOW_MS);
  });

  it("refreshes stale tokens rejected by the usage probe even when expiresAt is still in the future", async () => {
    const { homeDir, credentialsPath } = makeClaudeHome({
      accessToken: "stale-access-token",
      refreshToken: "refresh-after-401",
      expiresAt: NOW_MS + 60 * 60 * 1000,
      scopes: ["user:profile"],
    });

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/oauth/token")) {
        return new Response(
          JSON.stringify({
            access_token: "retried-access-token",
            refresh_token: "retried-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      const headers = init?.headers as Record<string, string>;
      if (headers.Authorization === "Bearer stale-access-token") {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      expect(headers.Authorization).toBe("Bearer retried-access-token");
      return new Response(JSON.stringify({ five_hour: { utilization: 12 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const refreshed = await ensureClaudeCredentialsFresh({
      homeDir,
      env: {},
      nowMs: NOW_MS,
    });

    expect(refreshed).toBe(true);
    const saved = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
      claudeAiOauth: Record<string, unknown>;
    };
    expect(saved.claudeAiOauth.accessToken).toBe("retried-access-token");
    expect(saved.claudeAiOauth.refreshToken).toBe("retried-refresh-token");
  });

  it("copies valid home credentials into a stale CLAUDE_CONFIG_DIR shadow file", async () => {
    const configDir = mkdtempSync(nodePath.join(os.tmpdir(), "synara-claude-config-"));
    tempDirs.push(configDir);
    const configCredentialsPath = nodePath.join(configDir, ".credentials.json");
    writeFileSync(
      configCredentialsPath,
      JSON.stringify({
        claudeAiOauth: {
          accessToken: "shadowing-stale-access-token",
          expiresAt: NOW_MS + 60 * 60 * 1000,
          scopes: ["user:profile"],
        },
      }),
      "utf8",
    );

    const { homeDir } = makeClaudeHome({
      accessToken: "valid-home-access-token",
      refreshToken: "home-refresh-token",
      expiresAt: NOW_MS + 60 * 60 * 1000,
      scopes: ["user:profile"],
    });

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      if (headers.Authorization === "Bearer shadowing-stale-access-token") {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      expect(headers.Authorization).toBe("Bearer valid-home-access-token");
      return new Response(JSON.stringify({ five_hour: { utilization: 12 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const refreshed = await ensureClaudeCredentialsFresh({
      homeDir,
      env: { CLAUDE_CONFIG_DIR: configDir },
      nowMs: NOW_MS,
    });

    expect(refreshed).toBe(true);
    const saved = JSON.parse(readFileSync(configCredentialsPath, "utf8")) as {
      claudeAiOauth: Record<string, unknown>;
    };
    expect(saved.claudeAiOauth.accessToken).toBe("valid-home-access-token");
    expect(saved.claudeAiOauth.refreshToken).toBe("home-refresh-token");
  });
});

describe("isClaudeOAuthAccessTokenAccepted", () => {
  it("rejects auth failures", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(isClaudeOAuthAccessTokenAccepted("token")).resolves.toBe(false);
  });

  it("does not treat rate limits as accepted", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(isClaudeOAuthAccessTokenAccepted("token")).resolves.toBe(false);
  });
});

describe("isClaudeOAuthCredentialSourceValid", () => {
  it("treats locally expired credentials as invalid without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const valid = await isClaudeOAuthCredentialSourceValid(
      {
        credentialsPath: "/tmp/.credentials.json",
        creds: {
          accessToken: "expired-access-token",
          refreshToken: undefined,
          expiresAtMs: NOW_MS - 60_000,
          subscriptionType: undefined,
          rateLimitTier: undefined,
          scopes: [],
        },
      },
      NOW_MS,
    );

    expect(valid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats non-expired credentials as valid when the usage probe is rate limited", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const valid = await isClaudeOAuthCredentialSourceValid(
      {
        credentialsPath: "/tmp/.credentials.json",
        creds: {
          accessToken: "still-valid-access-token",
          refreshToken: "refresh",
          expiresAtMs: NOW_MS + 60 * 60 * 1000,
          subscriptionType: undefined,
          rateLimitTier: undefined,
          scopes: [],
        },
      },
      NOW_MS,
    );

    expect(valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("shouldRefreshClaudeOAuthCreds", () => {
  it("refreshes before expiry inside the buffer window", () => {
    expect(
      shouldRefreshClaudeOAuthCreds(
        {
          accessToken: "token",
          refreshToken: "refresh",
          expiresAtMs: NOW_MS + 60_000,
          subscriptionType: undefined,
          rateLimitTier: undefined,
          scopes: [],
        },
        NOW_MS,
      ),
    ).toBe(true);
  });

  it("uses JWT exp when expiresAt is missing from the credentials file", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor((NOW_MS + 60_000) / 1000) }),
    ).toString("base64url");
    const jwt = `${header}.${payload}.sig`;

    expect(
      shouldRefreshClaudeOAuthCreds(
        {
          accessToken: jwt,
          refreshToken: "refresh",
          expiresAtMs: undefined,
          subscriptionType: undefined,
          rateLimitTier: undefined,
          scopes: [],
        },
        NOW_MS,
      ),
    ).toBe(true);
    expect(
      getClaudeOAuthExpiresAtMs({
        accessToken: jwt,
        refreshToken: "refresh",
        expiresAtMs: undefined,
        subscriptionType: undefined,
        rateLimitTier: undefined,
        scopes: [],
      }),
    ).toBe(NOW_MS + 60_000);
  });
});

describe("preferClaudeOAuthOverApiKeyEnv", () => {
  it("drops a stale inherited API key when OAuth credentials are present", () => {
    const { homeDir } = makeClaudeHome({
      accessToken: "oauth-access-token",
      refreshToken: "oauth-refresh-token",
      expiresAt: NOW_MS + 60 * 60 * 1000,
    });

    const env = preferClaudeOAuthOverApiKeyEnv(
      {
        ANTHROPIC_API_KEY: "stale-api-key",
        PATH: "/usr/bin",
      },
      { homeDir },
    );

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
  });
});

describe("persistClaudeOAuthCredentials", () => {
  it("writes a stable credentials.json shape", () => {
    const credentialsPath = nodePath.join(
      mkdtempSync(nodePath.join(os.tmpdir(), "synara-claude-write-")),
      ".credentials.json",
    );
    tempDirs.push(nodePath.dirname(credentialsPath));

    persistClaudeOAuthCredentials(credentialsPath, {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAtMs: NOW_MS + 3_600_000,
      subscriptionType: "pro",
      rateLimitTier: undefined,
      scopes: ["user:profile"],
    });

    const saved = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
      claudeAiOauth: Record<string, unknown>;
    };
    expect(saved.claudeAiOauth.accessToken).toBe("access");
    expect(saved.claudeAiOauth.refreshToken).toBe("refresh");
    expect(saved.claudeAiOauth.expiresAt).toBe(NOW_MS + 3_600_000);
  });
});
