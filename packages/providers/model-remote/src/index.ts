import type {
  ClassificationRequest,
  ClassificationResult,
  GenerationRequest,
  GenerationResult,
  ModelProvider
} from "../../../core/src/contracts.js";

export class RemoteModelProvider implements ModelProvider {
  providerName = "remote-model-future";

  async classifyIntent(_request: ClassificationRequest): Promise<ClassificationResult | null> {
    throw new Error("Remote model providers are intentionally disabled in local v1.");
  }

  async generateReply(_request: GenerationRequest): Promise<GenerationResult> {
    throw new Error("Remote model providers are intentionally disabled in local v1.");
  }
}
