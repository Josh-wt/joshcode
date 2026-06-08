import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

import {
  measureWavPeakAmplitude,
  MIN_VOICE_PEAK_AMPLITUDE,
  transcribeVoiceWithOpenRouter,
  VOICE_NO_SPEECH_DETECTED_MESSAGE,
} from "./openRouterVoiceTranscription";

function encodeTestMono16BitWav(samples: readonly number[], sampleRateHz = 24_000): Buffer {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const dataView = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      dataView.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  dataView.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, 1, true);
  dataView.setUint16(22, 1, true);
  dataView.setUint32(24, sampleRateHz, true);
  dataView.setUint32(28, sampleRateHz * 2, true);
  dataView.setUint16(32, 2, true);
  dataView.setUint16(34, 16, true);
  writeAscii(36, "data");
  dataView.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    dataView.setInt16(offset, Math.round(pcm), true);
    offset += 2;
  }

  return Buffer.from(bytes);
}

const SPEECH_LIKE_WAV = encodeTestMono16BitWav(Array.from({ length: 24_000 }, (_, index) => Math.sin(index / 120) * 0.25));
const SPEECH_LIKE_WAV_BASE64 = SPEECH_LIKE_WAV.toString("base64");
const SILENT_WAV = encodeTestMono16BitWav(Array.from({ length: 24_000 }, () => 0));
const SILENT_WAV_BASE64 = SILENT_WAV.toString("base64");

describe("openRouterVoiceTranscription helpers", () => {
  it("measures peak amplitude from mono wav pcm data", () => {
    expect(measureWavPeakAmplitude(SPEECH_LIKE_WAV)).toBeGreaterThan(MIN_VOICE_PEAK_AMPLITUDE);
    expect(measureWavPeakAmplitude(SILENT_WAV)).toBe(0);
  });
});

describe("transcribeVoiceWithOpenRouter", () => {
  it("posts base64 wav audio to the OpenRouter transcription endpoint", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ text: "hello there" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await transcribeVoiceWithOpenRouter({
      request: {
        mimeType: "audio/wav",
        sampleRateHz: 24_000,
        durationMs: 1_000,
        audioBase64: SPEECH_LIKE_WAV_BASE64,
      },
      apiKey: "test-openrouter-key",
      fetchImpl,
      referer: "https://synara.local",
      title: "Synara",
    });

    expect(result.text).toBe("hello there");
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
    expect(url).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-openrouter-key",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://synara.local",
      "X-OpenRouter-Title": "Synara",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "microsoft/mai-transcribe-1.5",
      language: "en",
      input_audio: {
        data: SPEECH_LIKE_WAV_BASE64,
        format: "wav",
      },
    });
  });

  it("rejects silent recordings before calling OpenRouter", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      transcribeVoiceWithOpenRouter({
        request: {
          mimeType: "audio/wav",
          sampleRateHz: 24_000,
          durationMs: 1_000,
          audioBase64: SILENT_WAV_BASE64,
        },
        apiKey: "test-openrouter-key",
        fetchImpl,
      }),
    ).rejects.toThrow(VOICE_NO_SPEECH_DETECTED_MESSAGE);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps empty provider transcripts to a no-speech error", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ text: "" }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      transcribeVoiceWithOpenRouter({
        request: {
          mimeType: "audio/wav",
          sampleRateHz: 24_000,
          durationMs: 1_000,
          audioBase64: SPEECH_LIKE_WAV_BASE64,
        },
        apiKey: "test-openrouter-key",
        fetchImpl,
      }),
    ).rejects.toThrow(VOICE_NO_SPEECH_DETECTED_MESSAGE);
  });
});
