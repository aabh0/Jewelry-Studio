import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import os from "node:os";
import path from "node:path";

function defaultDataDir(): string {
  if (process.platform === "win32") {
    return path.join(process.env.USERPROFILE ?? os.homedir(), "JewelryStudio");
  }
  return path.join(os.homedir(), "JewelryStudio");
}

const optionalStr = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const intWithDefault = (d: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : d))
    .pipe(z.number().int().nonnegative());

const floatWithDefault = (d: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : d))
    .pipe(z.number().nonnegative());

export const env = createEnv({
  server: {
    HIGGSFIELD_API_KEY: optionalStr,
    HIGGSFIELD_API_SECRET: optionalStr,
    HIGGSFIELD_BASE_URL: z.string().url().default("https://api.higgsfield.ai"),
    HIGGSFIELD_CLI_PATH: optionalStr,
    ANTHROPIC_API_KEY: optionalStr,
    CLAUDE_DIRECTOR_MODEL: z.string().default("claude-opus-5-5"),
    CLAUDE_QA_MODEL: z.string().default("claude-haiku-5-5"),
    DATA_DIR: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? path.resolve(v.trim()) : defaultDataDir())),
    FFMPEG_PATH: optionalStr,
    FFPROBE_PATH: optionalStr,
    WORKER_CONCURRENCY_PROVIDER: intWithDefault(4),
    WORKER_CONCURRENCY_FFMPEG: intWithDefault(1),
    WORKER_CONCURRENCY_CLAUDE: intWithDefault(3),
    DAILY_SPEND_CAP_USD: floatWithDefault(50),
    PORT: intWithDefault(3123),
    HOST: z.string().default("127.0.0.1"),
    MOCK_PROVIDERS: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: false,
});

export type Env = typeof env;

export function dbPath(): string {
  return process.env.DB_PATH && process.env.DB_PATH.trim() !== ""
    ? path.resolve(process.env.DB_PATH)
    : path.join(env.DATA_DIR, "studio.sqlite");
}
