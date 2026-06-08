import { Buffer } from "node:buffer";

export const OPENROUTER_TRANSCRIPTIONS_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
export const OPENROUTER_TRANSCRIPTION_MODEL = "microsoft/mai-transcribe-1.5";
export const OPENROUTER_TRANSCRIPTION_DEFAULT_LANGUAGE = "en";
export const MIN_VOICE_PEAK_AMPLITUDE = 0.008;
export const VOICE_NO_SPEECH_DETECTED_MESSAGE =
  "No speech was detected in the recording. Hold the mic button longer and speak clearly.";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 120_000;
const MIN_PCM_SAMPLE_BYTES = 2;

export interface VoiceAudioPayload {
  readonly mimeType: string;
  readonly sampleRateHz: number;
  readonly durationMs: number;
  readonly audioBase64: string;
}

export function decodeVoiceAudioPayload(input: VoiceAudioPayload): Buffer {
  if (input.mimeType !== "audio/wav") {
    throw new Error("Only WAV audio is supported for voice transcription.");
  }
  if (input.sampleRateHz !== 24_000) {
    throw new Error("Voice transcription requires 24 kHz mono WAV audio.");
  }
  if (input.durationMs <= 0) {
    throw new Error("Voice messages must include a positive duration.");
  }
  if (input.durationMs > MAX_DURATION_MS) {
    throw new Error("Voice messages are limited to 120 seconds.");
  }

  const normalizedBase64 = normalizeBase64(input.audioBase64);
  if (!normalizedBase64 || !isLikelyBase64(normalizedBase64)) {
    throw new Error("The recorded audio could not be decoded.");
  }

  const audioBuffer = Buffer.from(normalizedBase64, "base64");
  if (!audioBuffer.length || audioBuffer.toString("base64") !== normalizedBase64) {
    throw new Error("The recorded audio could not be decoded.");
  }
  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new Error("Voice messages are limited to 10 MB.");
  }
  if (!isLikelyWavBuffer(audioBuffer)) {
    throw new Error("The recorded audio is not a valid WAV file.");
  }

  return audioBuffer;
}

export function measureWavPeakAmplitude(buffer: Buffer): number {
  const pcmOffset = findMono16BitPcmDataOffset(buffer);
  if (pcmOffset === null) {
    return 0;
  }

  let peak = 0;
  for (let offset = pcmOffset; offset + 1 < buffer.length; offset += MIN_PCM_SAMPLE_BYTES) {
    const sample = buffer.readInt16LE(offset) / 0x8000;
    const amplitude = Math.abs(sample);
    if (amplitude > peak) {
      peak = amplitude;
    }
  }

  return peak;
}

export async function transcribeVoiceWithOpenRouter(input: {
  readonly request: VoiceAudioPayload;
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch;
  readonly referer?: string;
  readonly title?: string;
  readonly language?: string;
}): Promise<{ readonly text: string }> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Voice transcription is unavailable in this runtime.");
  }

  const audioBuffer = decodeVoiceAudioPayload(input.request);
  if (measureWavPeakAmplitude(audioBuffer) < MIN_VOICE_PEAK_AMPLITUDE) {
    throw new Error(VOICE_NO_SPEECH_DETECTED_MESSAGE);
  }

  const response = await fetchImpl(OPENROUTER_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      ...(input.referer ? { "HTTP-Referer": input.referer } : {}),
      ...(input.title ? { "X-OpenRouter-Title": input.title } : {}),
    },
    body: JSON.stringify({
      model: OPENROUTER_TRANSCRIPTION_MODEL,
      language: input.language?.trim() || OPENROUTER_TRANSCRIPTION_DEFAULT_LANGUAGE,
      input_audio: {
        data: audioBuffer.toString("base64"),
        format: "wav",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readOpenRouterTranscriptionErrorMessage(response));
  }

  const payload = (await response.json().catch(() => null)) as {
    text?: unknown;
    transcript?: unknown;
    error?: { message?: unknown };
    message?: unknown;
  } | null;
  const text = readString(payload?.text) ?? readString(payload?.transcript);
  if (!text) {
    throw new Error(VOICE_NO_SPEECH_DETECTED_MESSAGE);
  }

  return { text };
}

async function readOpenRouterTranscriptionErrorMessage(response: Response): Promise<string> {
  let errorMessage = `Transcription failed with status ${response.status}.`;
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
      message?: unknown;
    } | null;
    const providerMessage =
      readString(payload?.error?.message) ?? readString(payload?.message) ?? null;
    if (providerMessage) {
      errorMessage = providerMessage;
    }
  } catch {
    // Keep the generic status-based message when the provider body is empty or invalid.
  }

  if (response.status === 401 || response.status === 403) {
    return "OpenRouter rejected the transcription request. Check your OPENROUTER_API_KEY.";
  }

  return errorMessage;
}

function normalizeBase64(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, "");
  return normalized.length > 0 ? normalized : null;
}

function isLikelyBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isLikelyWavBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  );
}

function findMono16BitPcmDataOffset(buffer: Buffer): number | null {
  if (!isLikelyWavBuffer(buffer) || buffer.length < 44) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkId === "data") {
      return chunkDataOffset;
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  return buffer.length > 44 ? 44 : null;
}

function readString(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}
