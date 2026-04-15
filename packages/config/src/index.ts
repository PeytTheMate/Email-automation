import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_MODE: z.enum(["local", "production"]).default("local"),
  PORT: z.coerce.number().default(4000),
  WEB_PORT: z.coerce.number().default(5173),
  DATABASE_URL: z.string().default("./data/local.db"),
  DEFAULT_EMAIL_PROVIDER: z.string().default("local"),
  DEFAULT_MODEL_PROVIDER: z.string().default("mock"),
  DEFAULT_SEND_PROVIDER: z.string().default("local"),
  LOCAL_ONLY_MODE: z.coerce.boolean().default(true),
  ENABLE_REMOTE_MODELS: z.coerce.boolean().default(false),
  ENABLE_GMAIL_READ: z.coerce.boolean().default(false),
  ENABLE_GMAIL_DRAFTS: z.coerce.boolean().default(false),
  ENABLE_GMAIL_SEND: z.coerce.boolean().default(false),
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_DEMO_LABEL: z.string().optional(),
  GMAIL_ALLOWLIST_SENDERS: z.string().optional(),
  GMAIL_ALLOWLIST_RECIPIENTS: z.string().optional(),
  REMOTE_MODEL_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  REMOTE_MODEL_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  REMOTE_MODEL_BASE_URL: z.string().default("https://api.openai.com/v1"),
  REMOTE_MODEL_NAME: z.string().default("gpt-5-mini"),
  MAX_INPUT_TOKENS: z.coerce.number().default(2500),
  MAX_OUTPUT_TOKENS: z.coerce.number().default(300),
  DAILY_GLOBAL_BUDGET_USD: z.coerce.number().default(10),
  DEFAULT_DRAFT_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.8),
  DEFAULT_AUTOSEND_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.97),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  APP_BASE_URL: z.string().default("http://localhost:4000"),
  REVIEW_UI_BASE_URL: z.string().default("http://localhost:5173"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1")
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = envSchema.parse(process.env);
  }

  return cachedConfig;
}

export function resetConfigCache() {
  cachedConfig = null;
}
