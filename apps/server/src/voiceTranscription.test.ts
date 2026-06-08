// FILE: voiceTranscription.test.ts
// Purpose: Verifies OpenRouter voice transcription wiring without contacting the network.
// Layer: Server test

import { Buffer } from "node:buffer";

import type { ServerVoiceTranscriptionInput } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import { transcribeVoiceWithOpenRouterSession } from "./voiceTranscription";

const WAV_BASE64 = Buffer.from(
  (() => {
    const sampleCount = 24_000;
    const bytes = new Uint8Array(44 + sampleCount * 2);
    const view = new DataView(bytes.buffer);
    const writeAscii = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };
    writeAscii(0, "RIFF");
    view.setUint32(4, 36 + sampleCount * 2, true);
    writeAscii(8, "WAVE");
    writeAscii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24_000, true);
    view.setUint32(28, 24_000 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, "data");
    view.setUint32(40, sampleCount * 2, true);
    for (let index = 0; index < sampleCount; index += 1) {
      view.setInt16(44 + index * 2, Math.round(Math.sin(index / 120) * 0.25 * 0x7fff), true);
    }
    return bytes;
  })(),
).toString("base64");

const baseRequest: ServerVoiceTranscriptionInput = {
  provider: "codex",
  cwd: "/tmp/project",
  mimeType: "audio/wav",
  sampleRateHz: 24_000,
  durationMs: 1_000,
  audioBase64: WAV_BASE64,
};

describe("transcribeVoiceWithOpenRouterSession", () => {
  it("uses the OpenRouter transcription backend", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ text: "hello" }), { status: 200 }),
    ) as unknown as typeof fetch;

    try {
      await transcribeVoiceWithOpenRouterSession({
        request: baseRequest,
        baseDir: "/tmp/synara",
        fetchImpl,
      });

      const [url] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
      expect(url).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fails clearly when no OpenRouter API key is configured", async () => {
    await expect(
      transcribeVoiceWithOpenRouterSession({
        request: baseRequest,
        baseDir: "/tmp/missing-key",
      }),
    ).rejects.toThrow(/OpenRouter API key is not configured/);
  });
});
