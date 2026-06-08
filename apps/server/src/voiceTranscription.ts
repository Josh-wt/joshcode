// FILE: voiceTranscription.ts
// Purpose: Proxies validated WAV voice clips to OpenRouter speech-to-text.
// Layer: Server utility
// Exports: transcribeVoiceWithOpenRouterSession

import type {
  ServerVoiceTranscriptionInput,
  ServerVoiceTranscriptionResult,
} from "@t3tools/contracts";
import {
  isOpenRouterVoiceTranscriptionConfigured,
  resolveOpenRouterApiKey,
} from "@t3tools/shared/openRouterApiKey";
import { transcribeVoiceWithOpenRouter } from "@t3tools/shared/openRouterVoiceTranscription";

export function isVoiceTranscriptionConfigured(baseDir: string): boolean {
  return isOpenRouterVoiceTranscriptionConfigured({ baseDir });
}

export async function transcribeVoiceWithOpenRouterSession(input: {
  readonly request: ServerVoiceTranscriptionInput;
  readonly baseDir: string;
  readonly fetchImpl?: typeof fetch;
  readonly referer?: string;
  readonly title?: string;
}): Promise<ServerVoiceTranscriptionResult> {
  const apiKey = resolveOpenRouterApiKey({ baseDir: input.baseDir });
  if (!apiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Set OPENROUTER_API_KEY or save a key to ~/.synara/userdata/openrouter-api-key.",
    );
  }

  return transcribeVoiceWithOpenRouter({
    request: input.request,
    apiKey,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
    ...(input.referer ? { referer: input.referer } : {}),
    ...(input.title ? { title: input.title } : {}),
  });
}
