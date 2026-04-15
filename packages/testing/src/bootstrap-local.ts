import { getConfig } from "../../config/src/index.js";
import { initializeDatabase, settingsRepository } from "../../db/src/index.js";
import type {
  EmailProvider,
  KnowledgeProvider,
  ModelProvider,
  ProviderRegistry,
  SendProvider
} from "../../core/src/index.js";
import { LocalEmailProvider } from "../../providers/email-local/src/index.js";
import { GmailEmailProvider } from "../../providers/email-gmail/src/index.js";
import { LocalKnowledgeProvider } from "../../providers/knowledge-local/src/index.js";
import {
  MockModelProvider,
  OllamaLocalModelProvider
} from "../../providers/model-local/src/index.js";
import { RemoteModelProvider } from "../../providers/model-remote/src/index.js";
import { LocalSendProvider } from "../../providers/send-local/src/index.js";
import { seedLocalData } from "./seed-local-data.js";

type LocalProviders = {
  modelProvider: ModelProvider;
  knowledgeProvider: KnowledgeProvider;
  sendProvider: SendProvider;
  emailProvider: EmailProvider;
};

function createBaseProviders() {
  return {
    localEmailProvider: new LocalEmailProvider(),
    gmailProvider: new GmailEmailProvider(),
    mockModelProvider: new MockModelProvider(),
    ollamaModelProvider: new OllamaLocalModelProvider(),
    remoteModelProvider: new RemoteModelProvider(),
    knowledgeProvider: new LocalKnowledgeProvider(),
    localSendProvider: new LocalSendProvider()
  };
}

export async function ensureRuntimeBootstrap() {
  initializeDatabase();

  if (settingsRepository.listMailboxes().length === 0) {
    await seedLocalData();
  }
}

export async function ensureLocalBootstrap() {
  const config = getConfig();
  if (config.DEFAULT_EMAIL_PROVIDER !== "local") {
    throw new Error("Local bootstrap only supports DEFAULT_EMAIL_PROVIDER=local.");
  }
  if (config.DEFAULT_SEND_PROVIDER !== "local") {
    throw new Error("Local bootstrap only supports DEFAULT_SEND_PROVIDER=local.");
  }

  await ensureRuntimeBootstrap();
}

export function createLocalProviders(): LocalProviders {
  const config = getConfig();
  if (!["mock", "ollama", "remote"].includes(config.DEFAULT_MODEL_PROVIDER)) {
    throw new Error(
      "Local bootstrap supports DEFAULT_MODEL_PROVIDER values of 'mock', 'ollama', or 'remote'."
    );
  }

  const base = createBaseProviders();
  return {
    modelProvider:
      config.DEFAULT_MODEL_PROVIDER === "remote"
        ? base.remoteModelProvider
        : config.DEFAULT_MODEL_PROVIDER === "ollama"
        ? base.ollamaModelProvider
        : base.mockModelProvider,
    knowledgeProvider: base.knowledgeProvider,
    sendProvider: base.localSendProvider,
    emailProvider: base.localEmailProvider
  };
}

export function createRuntimeProviderRegistry(): ProviderRegistry {
  const config = getConfig();
  const base = createBaseProviders();

  const defaultModelProvider: ModelProvider =
    config.DEFAULT_MODEL_PROVIDER === "remote"
      ? base.remoteModelProvider
      : config.DEFAULT_MODEL_PROVIDER === "ollama"
        ? base.ollamaModelProvider
        : base.mockModelProvider;

  return {
    getEmailProvider(mailbox) {
      return mailbox.connectionMode === "gmail_test" ? base.gmailProvider : base.localEmailProvider;
    },
    getModelProvider(mailbox) {
      switch (mailbox.defaultModelProvider) {
        case "remote":
          return config.ENABLE_REMOTE_MODELS ? base.remoteModelProvider : defaultModelProvider;
        case "ollama":
          return base.ollamaModelProvider;
        case "mock":
          return base.mockModelProvider;
        default:
          return defaultModelProvider;
      }
    },
    getKnowledgeProvider() {
      return base.knowledgeProvider;
    },
    getSendProvider(mailbox) {
      if (mailbox.connectionMode === "gmail_test") {
        return base.gmailProvider;
      }

      return base.localSendProvider;
    }
  };
}
