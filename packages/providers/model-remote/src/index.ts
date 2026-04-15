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

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getRemoteApiKey() {
  const config = getConfig();
  if (!config.ENABLE_REMOTE_MODELS) {
    throw new Error("Remote model support requires ENABLE_REMOTE_MODELS=true.");
  }

  if (config.REMOTE_MODEL_PROVIDER === "gemini") {
    const geminiApiKey =
      config.REMOTE_MODEL_API_KEY ?? config.GEMINI_API_KEY ?? config.GOOGLE_API_KEY;

    if (!geminiApiKey) {
      throw new Error(
        "Gemini support requires REMOTE_MODEL_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY."
      );
    }

    return geminiApiKey;
  }

  if (!config.REMOTE_MODEL_API_KEY) {
    throw new Error(
      "OpenAI-compatible remote model support requires REMOTE_MODEL_API_KEY."
    );
  }

  return config.REMOTE_MODEL_API_KEY;
}

function buildOpenAiAuthHeaders() {
  return {
    Authorization: `Bearer ${getRemoteApiKey()}`,
    "Content-Type": "application/json"
  };
}

async function callOpenAiResponsesApi(input: string) {
  const config = getConfig();
  const response = await fetch(`${normalizeBaseUrl(config.REMOTE_MODEL_BASE_URL)}/responses`, {
    method: "POST",
    headers: buildOpenAiAuthHeaders(),
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

function extractGeminiText(payload: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned no text candidate.");
  }

  return text;
}

async function callGeminiGenerateContentApi(input: string) {
  const config = getConfig();
  const response = await fetch(
    `${normalizeBaseUrl(config.REMOTE_MODEL_BASE_URL)}/models/${encodeURIComponent(config.REMOTE_MODEL_NAME)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getRemoteApiKey()
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: input
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: config.MAX_OUTPUT_TOKENS
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini model request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  return extractGeminiText(payload);
}

async function callRemoteModel(input: string) {
  const config = getConfig();
  if (config.REMOTE_MODEL_PROVIDER === "gemini") {
    return callGeminiGenerateContentApi(input);
  }

  return callOpenAiResponsesApi(input);
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export class RemoteModelProvider implements ModelProvider {
  providerName =
    getConfig().REMOTE_MODEL_PROVIDER === "gemini"
      ? "remote-gemini-generate-content"
      : "remote-openai-responses";

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
      const raw = await callRemoteModel(prompt);
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

    const raw = await callRemoteModel(prompt);
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
