import { containsAny } from "../../../core/src/lib/text.js";
import type {
  ClassificationRequest,
  ClassificationResult,
  GenerationRequest,
  GenerationResult,
  ModelProvider
} from "../../../core/src/contracts.js";
import { getConfig } from "../../../config/src/index.js";

function buildGreeting(name: string | null | undefined, style: string) {
  const safeName = name?.trim() ? name.trim() : "";
  if (style === "warm") {
    return safeName ? `Hi ${safeName},` : "Hi there,";
  }
  if (style === "friendly") {
    return safeName ? `Hello ${safeName},` : "Hello,";
  }

  return safeName ? `Hello ${safeName},` : "Hello,";
}

function buildClosing(closingStyle: string, approvedClosings: string[]) {
  return approvedClosings[0] ?? (closingStyle === "warm" ? "Please let us know if anything else would help." : "Please let us know if you need anything else.");
}

function limitSentences(text: string, maxSentences: number) {
  if (!Number.isFinite(maxSentences) || maxSentences <= 0) {
    return text.trim();
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= maxSentences) {
    return text.trim();
  }

  return sentences.slice(0, maxSentences).join(" ").trim();
}

function applyToneConstraints(args: {
  bodyLines: string[];
  forbiddenPhrases: string[];
  maxReplySentences: number;
}) {
  const sanitizedLines = args.bodyLines.map((line) => {
    let nextLine = line.trim();
    for (const phrase of args.forbiddenPhrases) {
      if (phrase) {
        nextLine = nextLine.replaceAll(phrase, "").replace(/\s{2,}/g, " ").trim();
      }
    }

    return nextLine;
  });

  return limitSentences(sanitizedLines.filter(Boolean).join("\n\n"), args.maxReplySentences);
}

export class MockModelProvider implements ModelProvider {
  providerName = "mock-template-provider";

  async classifyIntent(request: ClassificationRequest): Promise<ClassificationResult | null> {
    const text = `${request.normalizedEmail.subject}\n${request.normalizedEmail.normalizedBodyText}`.toLowerCase();

    if (containsAny(text, ["after work", "late today", "open late"])) {
      return {
        intent: "business_hours_question",
        confidence: 0.74,
        secondaryIntents: ["booking_question"],
        extractedEntities: {
          requestedDay: text.includes("today") ? "today" : undefined,
          requestedTimeWindow: "after_work",
          requestedLocationHint: undefined,
          requestedDocumentTypes: [],
          bookingContext: undefined,
          hasMultipleQuestions: false,
          mentionsAttachment: false,
          sensitiveKeywords: [],
          matchedTopics: ["business_hours_question", "booking_question"]
        },
        riskFlags: ["low_confidence"],
        reasoningSummary: "Fallback model saw an hours question but kept confidence low because the request is ambiguous.",
        providerUsed: this.providerName
      };
    }

    return {
      intent: "unknown",
      confidence: 0.42,
      secondaryIntents: [],
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
      riskFlags: ["low_confidence"],
      reasoningSummary: "Fallback model could not confidently map this email to a supported v1 intent.",
      providerUsed: this.providerName
    };
  }

  async generateReply(request: GenerationRequest): Promise<GenerationResult> {
    if (request.retrieval.facts.length === 0) {
      return {
        subject: `Re: ${request.normalizedEmail.subject}`,
        body: "We need a team member to review this message before replying.",
        confidenceNote: "Generation was blocked because no trusted facts were retrieved.",
        generationMetadata: {
          provider: this.providerName,
          mode: "template",
          grounded: false
        }
      };
    }

    const greeting = buildGreeting(request.normalizedEmail.senderName, request.toneProfile.greetingStyle);
    const closing = buildClosing(request.toneProfile.closingStyle, request.toneProfile.approvedClosings);
    const factValues = request.retrieval.facts.map((fact) => fact.value);
    let bodyLines: string[] = [];

    switch (request.classification.intent) {
      case "business_hours_question":
        bodyLines = [
          `${greeting}`,
          `${factValues[0]}`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
        break;
      case "location_question":
        bodyLines = [
          `${greeting}`,
          `Our office is located at ${factValues[0]}.`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
        break;
      case "booking_question":
        bodyLines = [
          `${greeting}`,
          `You can book with us here: ${factValues.find((fact) => fact.startsWith("http")) ?? factValues[0]}.`,
          `${factValues.find((fact) => !fact.startsWith("http")) ?? "If you have a preferred time, include it in your request."}`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
        break;
      case "required_documents_question":
        bodyLines = [
          `${greeting}`,
          `Please bring ${factValues[0]}.`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
        break;
      case "parking_question":
        bodyLines = [
          `${greeting}`,
          `${factValues[0]}`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
        break;
      case "reschedule_request":
        bodyLines = [
          `${greeting}`,
          `To reschedule, please use ${factValues.find((fact) => fact.startsWith("http")) ?? factValues[0]}.`,
          `${factValues.find((fact) => !fact.startsWith("http")) ?? "We will help once we receive your preferred time."}`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
        break;
      default:
        bodyLines = [
          `${greeting}`,
          `A team member will review your message shortly.`,
          `${closing}`,
          request.toneProfile.signatureTemplate
        ];
    }

    return {
      subject: `Re: ${request.normalizedEmail.subject}`,
      body: applyToneConstraints({
        bodyLines,
        forbiddenPhrases: request.toneProfile.forbiddenPhrases,
        maxReplySentences: request.automationProfile.maxReplySentences
      }),
      confidenceNote: "Reply grounded only in local structured facts.",
      generationMetadata: {
        provider: this.providerName,
        mode: "template",
        grounded: true
      }
    };
  }
}

export class OllamaLocalModelProvider implements ModelProvider {
  providerName = "ollama-local";

  async classifyIntent(_request: ClassificationRequest): Promise<ClassificationResult | null> {
    return null;
  }

  async generateReply(request: GenerationRequest): Promise<GenerationResult> {
    const config = getConfig();

    const prompt = [
      "You are generating a business email reply.",
      "Use only the provided business facts.",
      "If facts are insufficient, say NEEDS_HUMAN_REVIEW.",
      `Tone profile: ${request.toneProfile.description}`,
      `Facts: ${request.retrieval.facts.map((fact) => `${fact.title}: ${fact.value}`).join(" | ")}`,
      `Email: ${request.normalizedEmail.normalizedBodyText}`
    ].join("\n");

    const response = await fetch(`${config.OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as { response: string };

    return {
      subject: `Re: ${request.normalizedEmail.subject}`,
      body: payload.response.trim(),
      confidenceNote: "Generated by a local Ollama runtime. Review before sending.",
      generationMetadata: {
        provider: this.providerName,
        mode: "local_llm",
        grounded: true
      }
    };
  }
}
