import * as Fs from "node:fs";
import * as Path from "node:path";

export const OPENROUTER_API_KEY_ENV = "OPENROUTER_API_KEY";
export const OPENROUTER_API_KEY_FILE_NAME = "openrouter-api-key";

export function normalizeOpenRouterApiKey(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

export function resolveOpenRouterApiKeyFileCandidates(baseDir: string): readonly string[] {
  const userdataDir = Path.join(baseDir, "userdata");
  return [
    Path.join(userdataDir, OPENROUTER_API_KEY_FILE_NAME),
    Path.join(userdataDir, "secrets", OPENROUTER_API_KEY_FILE_NAME),
  ];
}

export function readOpenRouterApiKeyFromFile(
  filePath: string,
  readFileSync: typeof Fs.readFileSync = Fs.readFileSync,
  existsSync: typeof Fs.existsSync = Fs.existsSync,
): string | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return normalizeOpenRouterApiKey(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function resolveOpenRouterApiKey(input?: {
  readonly env?: NodeJS.ProcessEnv;
  readonly baseDir?: string;
  readonly readFileSync?: typeof Fs.readFileSync;
  readonly existsSync?: typeof Fs.existsSync;
}): string | null {
  const env = input?.env ?? process.env;
  const fromEnv = normalizeOpenRouterApiKey(env[OPENROUTER_API_KEY_ENV]);
  if (fromEnv) {
    return fromEnv;
  }

  const baseDir = input?.baseDir?.trim();
  if (!baseDir) {
    return null;
  }

  const readFileSync = input?.readFileSync ?? Fs.readFileSync;
  const existsSync = input?.existsSync ?? Fs.existsSync;
  for (const filePath of resolveOpenRouterApiKeyFileCandidates(baseDir)) {
    const fromFile = readOpenRouterApiKeyFromFile(filePath, readFileSync, existsSync);
    if (fromFile) {
      return fromFile;
    }
  }

  return null;
}

export function isOpenRouterVoiceTranscriptionConfigured(input?: {
  readonly env?: NodeJS.ProcessEnv;
  readonly baseDir?: string;
}): boolean {
  return resolveOpenRouterApiKey(input) !== null;
}
