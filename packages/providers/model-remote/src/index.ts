import type {
  ClassificationRequest,
  ClassificationResult,
  GenerationRequest,
  GenerationResult,
  ModelProvider
} from "../../../core/src/contracts.js";
import { getConfig } from "../../../config/src/index.js";
import type { Intent, RiskFlag } from "../../../schemas/src/index.js";

const SUPPORTED_INTENTS: Intent[] = [
  "business_hours_question",
  "location_question",
  "booking_question",
  "required_documents_question",
  "parking_question",
  "reschedule_request",
  "billing_question",
  "complaint",
  "unknown"
];

const SUPPORTED_RISK_FLAGS: RiskFlag[] = [
  "low_confidence",
  "multiple_asks",
  "sensitive_keyword",
  "attachment_dependency",
  "prompt_injection",
  "auto_reply_candidate",
  "long_thread",
  "newsletter_candidate",
  "billing_language",
  "complaint_language",
  "knowledge_gap"
];

function limitSentences(text: string, maxSentences: number) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.slice(0, maxSentences).join(" ").trim();
}

function findUnsupportedUrls(body: string, allowedFacts: string[]) {
  const urls = body.match(/https?:\/\/\S+/gi) ?? [];
  return urls.filter((url) => !allowedFacts.some((fact) => fact.includes(url)));
}

function buildAuthHeaders() {
  const config = getConfig();
  if (!config.ENABLE_REMOTE_MODELS || !config.REMOTE_MODEL_API_KEY) {
    throw new Error("Remote model support requires ENABLE_REMOTE_MODELS=true and REMOTE_MODEL_API_KEY.");
  }

  return {
    Authorization: `Bearer ${config.REMOTE_MODEL_API_KEY}`,
    "Content-Type": "application/json"
  };
}

async function callResponsesApi(input: string) {
  const config = getConfig();
  const response = await fetch(`${config.REMOTE_MODEL_BASE_URL}/responses`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      model: config.REMOTE_MODEL_NAME,
      input,
      max_output_tokens: config.MAX_OUTPUT_TOKENS
    })
  });

  if (!response.ok) {
    throw new Error(`Remote model request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };

  if (!payload.output_text?.trim()) {
    throw new Error("Remote model returned no output_text.");
  }

  return payload.output_text.trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export class RemoteModelProvider implements ModelProvider {
  providerName = "remote-openai-responses";

  async classifyIntent(request: ClassificationRequest): Promise<ClassificationResult | null> {
    const prompt = [
      "Classify the incoming business email into the supported taxonomy.",
      `Supported intents: ${SUPPORTED_INTENTS.join(", ")}.`,
      "Return strict JSON with keys: intent, confidence, reasoningSummary, secondaryIntents, riskFlags.",
      "Be conservative. If unsure, return unknown with confidence under 0.75.",
      `Subject: ${request.normalizedEmail.subject}`,
      `Body: ${request.normalizedEmail.normalizedBodyText}`
    ].join("\n");

    try {
      const raw = await callResponsesApi(prompt);
      const parsed = safeJsonParse<{
        intent?: Intent;
        confidence?: number;
        reasoningSummary?: string;
        secondaryIntents?: Intent[];
        riskFlags?: string[];
      }>(raw);

      if (!parsed?.intent || !SUPPORTED_INTENTS.includes(parsed.intent)) {
        return null;
      }

      return {
        intent: parsed.intent,
        confidence:
          typeof parsed.confidence === "number"
            ? Math.max(0, Math.min(parsed.confidence, 1))
            : 0.5,
        secondaryIntents: (parsed.secondaryIntents ?? []).filter((intent) =>
          SUPPORTED_INTENTS.includes(intent)
        ),
        extractedEntities: {
          requestedDay: undefined,
          requestedTimeWindow: undefined,
          requestedLocationHint: undefined,
          requestedDocumentTypes: [],
          bookingContext: undefined,
          hasMultipleQuestions: false,
          mentionsAttachment: false,
          sensitiveKeywords: [],
          matchedTopics: []
        },
        riskFlags: (parsed.riskFlags ?? []).filter((flag): flag is RiskFlag =>
          SUPPORTED_RISK_FLAGS.includes(flag as RiskFlag)
        ),
        reasoningSummary: parsed.reasoningSummary ?? "Remote model classification completed.",
        providerUsed: this.providerName
      };
    } catch {
      return null;
    }
  }

  async generateReply(request: GenerationRequest): Promise<GenerationResult> {
    if (request.retrieval.facts.length === 0) {
      throw new Error("Remote model generation refused because no trusted facts were retrieved.");
    }

    const facts = request.retrieval.facts.map((fact) => `${fact.title}: ${fact.value}`);
    const prompt = [
      "Write a concise customer reply email using only the provided trusted facts.",
      "Do not invent facts, pricing, exceptions, promises, or policies.",
      "If the facts are not sufficient, respond exactly with NEEDS_HUMAN_REVIEW.",
      "Return strict JSON with keys: subject, body.",
      `Tone: ${request.toneProfile.description}`,
      `Forbidden phrases: ${request.toneProfile.forbiddenPhrases.join(", ") || "none"}`,
      `Maximum sentences: ${request.automationProfile.maxReplySentences}`,
      `Facts: ${facts.join(" | ")}`,
      `Original subject: ${request.normalizedEmail.subject}`,
      `Original body: ${request.normalizedEmail.normalizedBodyText}`
    ].join("\n");

    const raw = await callResponsesApi(prompt);
    if (raw.includes("NEEDS_HUMAN_REVIEW")) {
      throw new Error("Remote model flagged the message for human review.");
    }

    const parsed = safeJsonParse<{ subject?: string; body?: string }>(raw);
    if (!parsed?.body?.trim()) {
      throw new Error("Remote model did not return a valid JSON email body.");
    }

    const trimmedBody = limitSentences(
      parsed.body.trim(),
      request.automationProfile.maxReplySentences
    );

    const forbiddenPhrase = request.toneProfile.forbiddenPhrases.find((phrase) =>
      trimmedBody.toLowerCase().includes(phrase.toLowerCase())
    );
    if (forbiddenPhrase) {
      throw new Error(`Remote model used forbidden phrase: ${forbiddenPhrase}`);
    }

    const unsupportedUrls = findUnsupportedUrls(
      trimmedBody,
      request.retrieval.facts.map((fact) => fact.value)
    );
    if (unsupportedUrls.length > 0) {
      throw new Error(`Remote model introduced unsupported URL content: ${unsupportedUrls[0]}`);
    }

    return {
      subject: parsed.subject?.trim() || `Re: ${request.normalizedEmail.subject}`,
      body: trimmedBody,
      confidenceNote: "Generated by a hosted model and validated against local grounding rules.",
      generationMetadata: {
        provider: this.providerName,
        mode: "hosted_llm",
        grounded: true
      }
    };
  }
}
