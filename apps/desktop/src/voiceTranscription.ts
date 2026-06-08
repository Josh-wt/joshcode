// FILE: voiceTranscription.ts
// Purpose: Owns the desktop-specific voice transcription flow for Electron builds.
// Layer: Desktop IPC + OpenRouter upload bridge

import * as Os from "node:os";
import * as Path from "node:path";

import { app, ipcMain } from "electron";
import type {
  ServerVoiceTranscriptionInput,
  ServerVoiceTranscriptionResult,
} from "@t3tools/contracts";
import { resolveOpenRouterApiKey } from "@t3tools/shared/openRouterApiKey";
import { transcribeVoiceWithOpenRouter } from "@t3tools/shared/openRouterVoiceTranscription";

export const SERVER_TRANSCRIBE_VOICE_CHANNEL = "desktop:server-transcribe-voice";

function resolveDesktopBaseDir(): string {
  const fromEnv =
    process.env.SYNARA_HOME?.trim() ||
    process.env.DPCODE_HOME?.trim() ||
    process.env.T3CODE_HOME?.trim() ||
    "";
  return fromEnv.length > 0 ? fromEnv : Path.join(Os.homedir(), ".synara");
}

async function transcribeVoiceViaDesktopBridge(
  input: ServerVoiceTranscriptionInput,
): Promise<ServerVoiceTranscriptionResult> {
  const apiKey = resolveOpenRouterApiKey({ baseDir: resolveDesktopBaseDir() });
  if (!apiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Set OPENROUTER_API_KEY or save a key to ~/.synara/userdata/openrouter-api-key.",
    );
  }

  return transcribeVoiceWithOpenRouter({
    request: input,
    apiKey,
    referer: "https://synara.local",
    title: app.getName() || "Synara",
  });
}

export function registerDesktopVoiceTranscriptionHandler(): void {
  ipcMain.removeHandler(SERVER_TRANSCRIBE_VOICE_CHANNEL);
  ipcMain.handle(
    SERVER_TRANSCRIBE_VOICE_CHANNEL,
    async (_event, input: ServerVoiceTranscriptionInput) => transcribeVoiceViaDesktopBridge(input),
  );
}
