import { describe, expect, it } from "vitest";

import * as Fs from "node:fs";

import {
  isOpenRouterVoiceTranscriptionConfigured,
  readOpenRouterApiKeyFromFile,
  resolveOpenRouterApiKey,
} from "./openRouterApiKey";

const readFileSyncMock = ((...args: Parameters<typeof Fs.readFileSync>) => {
  const encoding = args[1];
  if (encoding === "utf8" || (typeof encoding === "object" && encoding?.encoding === "utf8")) {
    return "file-key";
  }
  return Buffer.from("file-key");
}) as typeof Fs.readFileSync;

describe("resolveOpenRouterApiKey", () => {
  it("prefers the OPENROUTER_API_KEY environment variable", () => {
    expect(
      resolveOpenRouterApiKey({
        env: { OPENROUTER_API_KEY: " env-key " },
        baseDir: "/tmp/synara",
        existsSync: () => true,
        readFileSync: readFileSyncMock,
      }),
    ).toBe("env-key");
  });

  it("reads the userdata key file when env is unset", () => {
    const key = resolveOpenRouterApiKey({
      env: {},
      baseDir: "/tmp/synara",
      existsSync: (path) => path === "/tmp/synara/userdata/openrouter-api-key",
      readFileSync: readFileSyncMock,
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
    expect(readOpenRouterApiKeyFromFile("/missing", readFileSyncMock, () => false)).toBeNull();
  });
});
