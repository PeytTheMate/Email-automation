import { nanoid } from "nanoid";

import type { PolicyDecision } from "../../../schemas/src/index.js";
import { policyDecisionSchema } from "../../../schemas/src/index.js";

import type { PolicyContext } from "../contracts.js";

const SAFE_AUTOMATION_INTENTS = new Set([
  "business_hours_question",
  "location_question",
  "booking_question",
  "required_documents_question",
  "parking_question"
]);

export function applyPolicy(context: PolicyContext): PolicyDecision {
  const { classification, retrieval, mailbox, automationProfile } = context;
  const triggeredRules: string[] = [];
  const hasHighRiskFlag = classification.riskFlags.some((flag) =>
    [
      "sensitive_keyword",
      "attachment_dependency",
      "prompt_injection",
      "complaint_language",
      "long_thread"
    ].includes(flag)
  );

  if (classification.riskFlags.includes("newsletter_candidate") || classification.riskFlags.includes("auto_reply_candidate")) {
    triggeredRules.push("blocked_non_customer_mail");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "blocked",
      allowMockAutoSend: false,
      rationale: "Message looks like an auto-reply or newsletter, so the sandbox blocks automated handling.",
      triggeredRules,
      riskLevel: "high",
      escalationTarget: null,
      createdAt: new Date().toISOString()
    });
  }

  if (!mailbox.enabledIntents.includes(classification.intent)) {
    triggeredRules.push("escalate_mailbox_intent_not_enabled");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "escalate",
      allowMockAutoSend: false,
      rationale: "This mailbox is not configured to automate the detected intent, so the message is escalated.",
      triggeredRules,
      riskLevel: "high",
      escalationTarget: mailbox.escalationTarget,
      createdAt: new Date().toISOString()
    });
  }

  if (
    classification.intent === "unknown" ||
    classification.intent === "complaint" ||
    classification.intent === "billing_question" ||
    hasHighRiskFlag
  ) {
    triggeredRules.push("forced_escalation_high_risk");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "escalate",
      allowMockAutoSend: false,
      rationale: "This message falls into a risky or unsupported category, so it should be escalated for human review.",
      triggeredRules,
      riskLevel: "high",
      escalationTarget: mailbox.escalationTarget,
      createdAt: new Date().toISOString()
    });
  }

  if (classification.confidence < automationProfile.confidenceThresholdDraft) {
    triggeredRules.push("escalate_low_confidence");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "escalate",
      allowMockAutoSend: false,
      rationale: "The classifier confidence is below the draft threshold, so the safe action is to escalate.",
      triggeredRules,
      riskLevel: "medium",
      escalationTarget: mailbox.escalationTarget,
      createdAt: new Date().toISOString()
    });
  }

  if (retrieval.facts.length === 0) {
    triggeredRules.push("escalate_missing_knowledge");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "escalate",
      allowMockAutoSend: false,
      rationale: "No trusted business facts were retrieved, so the system refuses to draft unsupported claims.",
      triggeredRules,
      riskLevel: "medium",
      escalationTarget: mailbox.escalationTarget,
      createdAt: new Date().toISOString()
    });
  }

  if (classification.riskFlags.includes("multiple_asks")) {
    triggeredRules.push("draft_multiple_asks");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "draft_only",
      allowMockAutoSend: false,
      rationale: "The message contains multiple asks, so the sandbox prepares a draft instead of auto-sending.",
      triggeredRules,
      riskLevel: "medium",
      escalationTarget: null,
      createdAt: new Date().toISOString()
    });
  }

  if (!SAFE_AUTOMATION_INTENTS.has(classification.intent) || automationProfile.blockedIntents.includes(classification.intent)) {
    triggeredRules.push("draft_non_whitelisted_intent");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "draft_only",
      allowMockAutoSend: false,
      rationale: "This intent can be drafted, but it is not eligible for auto-send under the current automation profile.",
      triggeredRules,
      riskLevel: "medium",
      escalationTarget: null,
      createdAt: new Date().toISOString()
    });
  }

  const meetsAutoSendThreshold =
    classification.confidence >= automationProfile.confidenceThresholdAutoSend &&
    automationProfile.allowedAutoSendIntents.includes(classification.intent) &&
    mailbox.connectionMode === "local_sandbox" &&
    mailbox.allowMockAutoSend &&
    automationProfile.approvalMode === "mock_auto_send";

  if (meetsAutoSendThreshold) {
    triggeredRules.push("allow_mock_auto_send_safe_faq");

    return policyDecisionSchema.parse({
      id: nanoid(),
      messageId: classification.messageId,
      classificationId: classification.id,
      action: "auto_send_allowed",
      allowMockAutoSend: true,
      rationale: "This is a trusted FAQ intent with strong confidence, no red flags, and mailbox settings that allow mock auto-send.",
      triggeredRules,
      riskLevel: "low",
      escalationTarget: null,
      createdAt: new Date().toISOString()
    });
  }

  triggeredRules.push("draft_safe_faq");

  return policyDecisionSchema.parse({
    id: nanoid(),
    messageId: classification.messageId,
    classificationId: classification.id,
    action: "draft_only",
    allowMockAutoSend: false,
    rationale: "The message is safe enough to draft, but the mailbox settings still require review before sending.",
    triggeredRules,
    riskLevel: "low",
    escalationTarget: null,
    createdAt: new Date().toISOString()
  });
}
