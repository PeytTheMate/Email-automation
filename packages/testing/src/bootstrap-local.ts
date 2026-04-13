import { getConfig } from "../../config/src/index.js";
import { initializeDatabase, settingsRepository } from "../../db/src/index.js";
import type {
  KnowledgeProvider,
  ModelProvider,
  SendProvider
} from "../../core/src/index.js";
import { LocalKnowledgeProvider } from "../../providers/knowledge-local/src/index.js";
import {
  MockModelProvider,
  OllamaLocalModelProvider
} from "../../providers/model-local/src/index.js";
import { LocalSendProvider } from "../../providers/send-local/src/index.js";
import { seedLocalData } from "./seed-local-data.js";

export async function ensureLocalBootstrap() {
  const config = getConfig();
  if (config.DEFAULT_EMAIL_PROVIDER !== "local") {
    throw new Error("Local bootstrap only supports DEFAULT_EMAIL_PROVIDER=local.");
  }
  if (config.DEFAULT_SEND_PROVIDER !== "local") {
    throw new Error("Local bootstrap only supports DEFAULT_SEND_PROVIDER=local.");
  }

  initializeDatabase();

  if (settingsRepository.listMailboxes().length === 0) {
    await seedLocalData();
  }
}

export function createLocalProviders(): {
  modelProvider: ModelProvider;
  knowledgeProvider: KnowledgeProvider;
  sendProvider: SendProvider;
} {
  const config = getConfig();
  if (!["mock", "ollama"].includes(config.DEFAULT_MODEL_PROVIDER)) {
    throw new Error(
      "Local bootstrap supports DEFAULT_MODEL_PROVIDER values of 'mock' or 'ollama'."
    );
  }

  return {
    modelProvider:
      config.DEFAULT_MODEL_PROVIDER === "ollama"
        ? new OllamaLocalModelProvider()
        : new MockModelProvider(),
    knowledgeProvider: new LocalKnowledgeProvider(),
    sendProvider: new LocalSendProvider()
  };
}
