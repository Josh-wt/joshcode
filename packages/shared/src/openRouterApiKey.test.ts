import { describe, expect, it } from "vitest";

import {
  isOpenRouterVoiceTranscriptionConfigured,
  readOpenRouterApiKeyFromFile,
  resolveOpenRouterApiKey,
} from "./openRouterApiKey";

describe("resolveOpenRouterApiKey", () => {
  it("prefers the OPENROUTER_API_KEY environment variable", () => {
    expect(
      resolveOpenRouterApiKey({
        env: { OPENROUTER_API_KEY: " env-key " },
        baseDir: "/tmp/synara",
        existsSync: () => true,
        readFileSync: () => "file-key",
      }),
    ).toBe("env-key");
  });

  it("reads the userdata key file when env is unset", () => {
    const key = resolveOpenRouterApiKey({
      env: {},
      baseDir: "/tmp/synara",
      existsSync: (path) => path === "/tmp/synara/userdata/openrouter-api-key",
      readFileSync: () => "file-key\n",
    });
    expect(key).toBe("file-key");
  });

  it("reports availability when either source is configured", () => {
    expect(
      isOpenRouterVoiceTranscriptionConfigured({
        env: { OPENROUTER_API_KEY: "configured" },
        baseDir: "/tmp/synara",
      }),
    ).toBe(true);
    expect(readOpenRouterApiKeyFromFile("/missing", () => "", () => false)).toBeNull();
  });
});
