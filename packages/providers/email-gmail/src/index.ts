import { Buffer } from "node:buffer";

import { getConfig } from "../../../config/src/index.js";
import type {
  DeliveryRequest,
  EmailProvider,
  EmailSyncResult,
  SendProvider,
  SyncedInboundMessage
} from "../../../core/src/contracts.js";
import { messageRepository } from "../../../db/src/index.js";

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessagePayload = {
  mimeType?: string;
  filename?: string;
  body?: {
    data?: string;
  };
  headers?: GmailHeader[];
  parts?: GmailMessagePayload[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePayload;
};

function requireConfig(name: "GMAIL_CLIENT_ID" | "GMAIL_CLIENT_SECRET" | "GMAIL_REFRESH_TOKEN") {
  const value = getConfig()[name];
  if (!value) {
    throw new Error(`Missing ${name} for Gmail integration.`);
  }

  return value;
}

function base64UrlDecode(value: string | undefined) {
  if (!value) {
    return "";
  }

  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getHeader(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function parseAddressHeader(value: string | null) {
  if (!value) {
    return {
      email: "",
      name: null as string | null
    };
  }

  const angleMatch = value.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1]?.replace(/"/g, "").trim() || null,
      email: angleMatch[2]?.trim().toLowerCase() ?? ""
    };
  }

  return {
    name: null,
    email: value.trim().toLowerCase()
  };
}

function splitAddressList(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => parseAddressHeader(part).email)
    .filter(Boolean);
}

function extractPlainText(payload: GmailMessagePayload | undefined): string {
  if (!payload) {
    return "";
  }

  if (payload.mimeType === "text/plain") {
    return base64UrlDecode(payload.body?.data);
  }

  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text.trim()) {
      return text;
    }
  }

  if (payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }

  return "";
}

function compilePattern(pattern: string) {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("@")) {
    return (value: string) => value.endsWith(normalized);
  }

  if (normalized.includes("*")) {
    const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp(`^${escaped}$`, "i");
    return (value: string) => regex.test(value);
  }

  return (value: string) => value === normalized;
}

function matchesPatterns(value: string, patterns: string[]) {
  if (patterns.length === 0) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return patterns
    .map(compilePattern)
    .filter(Boolean)
    .some((matcher) => matcher?.(normalized));
}

function asIsoDate(internalDate?: string) {
  if (!internalDate) {
    return new Date().toISOString();
  }

  const asNumber = Number(internalDate);
  if (!Number.isFinite(asNumber)) {
    return new Date().toISOString();
  }

  return new Date(asNumber).toISOString();
}

function toInboundMessage(message: GmailMessage): SyncedInboundMessage {
  const from = parseAddressHeader(getHeader(message.payload?.headers, "From"));

  return {
    providerName: "gmail",
    sourceMessageKey: `gmail:${message.id}`,
    externalMessageId: message.id,
    externalThreadId: message.threadId ?? null,
    externalHistoryId: message.historyId ?? null,
    senderEmail: from.email,
    senderName: from.name,
    recipients: splitAddressList(getHeader(message.payload?.headers, "To")),
    ccRecipients: splitAddressList(getHeader(message.payload?.headers, "Cc")),
    subject: getHeader(message.payload?.headers, "Subject") ?? "(no subject)",
    rawBody: extractPlainText(message.payload).trim() || message.snippet || "",
    receivedAt: asIsoDate(message.internalDate)
  };
}

export class GmailEmailProvider implements EmailProvider, SendProvider {
  providerName = "gmail";
  private accessToken: string | null = null;
  private accessTokenPromise: Promise<string> | null = null;

  private async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (!this.accessTokenPromise) {
      const clientId = requireConfig("GMAIL_CLIENT_ID");
      const clientSecret = requireConfig("GMAIL_CLIENT_SECRET");
      const refreshToken = requireConfig("GMAIL_REFRESH_TOKEN");

      this.accessTokenPromise = (async () => {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to refresh Gmail access token (${response.status}).`);
        }

        const payload = (await response.json()) as { access_token?: string };
        if (!payload.access_token) {
          throw new Error("Gmail token response did not include an access token.");
        }

        this.accessToken = payload.access_token;
        return payload.access_token;
      })();
    }

    return this.accessTokenPromise.finally(() => {
      this.accessTokenPromise = null;
    });
  }

  private async gmailRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API request failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  }

  private ensureReadEnabled(mailboxLabel?: string | null) {
    const config = getConfig();
    if (!config.ENABLE_GMAIL_READ) {
      throw new Error("ENABLE_GMAIL_READ must be true before syncing Gmail.");
    }

    if (mailboxLabel === null && !config.GMAIL_DEMO_LABEL) {
      throw new Error("Set a mailbox Gmail label filter or GMAIL_DEMO_LABEL before syncing.");
    }
  }

  private ensureDraftsEnabled() {
    if (!getConfig().ENABLE_GMAIL_DRAFTS) {
      throw new Error("ENABLE_GMAIL_DRAFTS must be true before creating Gmail drafts.");
    }
  }

  private ensureSendEnabled() {
    if (!getConfig().ENABLE_GMAIL_SEND) {
      throw new Error("ENABLE_GMAIL_SEND must be true before sending Gmail replies.");
    }
  }

  private resolveAllowedSenders(mailboxPatterns: string[]) {
    const configPatterns = (getConfig().GMAIL_ALLOWLIST_SENDERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return mailboxPatterns.length > 0 ? mailboxPatterns : configPatterns;
  }

  private resolveAllowedRecipients(mailboxPatterns: string[]) {
    const configPatterns = (getConfig().GMAIL_ALLOWLIST_RECIPIENTS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return mailboxPatterns.length > 0 ? mailboxPatterns : configPatterns;
  }

  async listMessages(args: {
    mailbox: import("../../../schemas/src/index.js").MailboxSettings;
    limit?: number;
    syncCursor?: string | null;
  }): Promise<EmailSyncResult> {
    this.ensureReadEnabled(args.mailbox.gmailLabelFilter ?? null);

    const label = args.mailbox.gmailLabelFilter ?? getConfig().GMAIL_DEMO_LABEL ?? null;
    const maxResults = Math.max(1, Math.min(args.limit ?? 10, 25));
    const queryParts = ["is:unread", "-from:me"];
    if (label) {
      queryParts.push(`label:${label}`);
    }

    const list = await this.gmailRequest<{
      messages?: Array<{ id: string }>;
      historyId?: string;
      resultSizeEstimate?: number;
    }>(`/messages?q=${encodeURIComponent(queryParts.join(" "))}&maxResults=${maxResults}`);

    const allowedSenders = this.resolveAllowedSenders(args.mailbox.allowedSenderPatterns);
    const messages: SyncedInboundMessage[] = [];

    for (const item of list.messages ?? []) {
      const full = await this.gmailRequest<GmailMessage>(`/messages/${item.id}?format=full`);
      const inbound = toInboundMessage(full);
      if (!inbound.senderEmail) {
        continue;
      }
      if (!matchesPatterns(inbound.senderEmail, allowedSenders)) {
        continue;
      }
      messages.push(inbound);
    }

    return {
      providerName: this.providerName,
      nextSyncCursor: list.historyId ?? args.syncCursor ?? null,
      messages
    };
  }

  async createDraft(request: DeliveryRequest) {
    this.ensureDraftsEnabled();

    const payload = {
      message: {
        raw: base64UrlEncode(this.buildMimeMessage(request)),
        threadId: request.externalThreadId ?? undefined
      }
    };

    const response = await this.gmailRequest<{
      id?: string;
      message?: { id?: string };
    }>("/drafts", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const outboxMessage = messageRepository.createOutboxMessage({
      messageId: request.messageId,
      draftId: request.draft.id,
      recipientEmail: request.recipientEmail,
      subject: request.draft.subject,
      body: request.draft.body,
      providerName: this.providerName,
      externalDraftId: response.id ?? null,
      externalMessageId: response.message?.id ?? null,
      deliveryStatus: "draft_created",
      failureReason: null,
      operatorUserId: request.operatorUserId ?? null,
      sentAt: new Date().toISOString(),
      deliveryMode: "draft"
    });

    messageRepository.updateDraft(request.draft.id, request.draft.body, "generated", {
      providerName: this.providerName,
      externalDraftId: response.id ?? null,
      externalMessageId: response.message?.id ?? null
    });

    return outboxMessage;
  }

  async sendReply(request: DeliveryRequest) {
    this.ensureSendEnabled();

    const allowedRecipients = this.resolveAllowedRecipients(
      request.mailbox.allowedOutboundRecipientPatterns
    );
    if (!matchesPatterns(request.recipientEmail, allowedRecipients)) {
      throw new Error(
        `Recipient ${request.recipientEmail} is not on the allowlist for Gmail live send.`
      );
    }

    const response = await this.gmailRequest<{ id?: string }>(
      "/messages/send",
      {
        method: "POST",
        body: JSON.stringify({
          raw: base64UrlEncode(this.buildMimeMessage(request)),
          threadId: request.externalThreadId ?? undefined
        })
      }
    );

    return messageRepository.createOutboxMessage({
      messageId: request.messageId,
      draftId: request.draft.id,
      recipientEmail: request.recipientEmail,
      subject: request.draft.subject,
      body: request.draft.body,
      providerName: this.providerName,
      externalDraftId: request.draft.externalDraftId ?? null,
      externalMessageId: response.id ?? null,
      deliveryStatus: "sent",
      failureReason: null,
      operatorUserId: request.operatorUserId ?? null,
      sentAt: new Date().toISOString(),
      deliveryMode: request.deliveryMode
    });
  }

  private buildMimeMessage(request: DeliveryRequest) {
    const headers = [
      `To: ${request.recipientEmail}`,
      `Subject: ${request.draft.subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "MIME-Version: 1.0"
    ];

    if (request.externalMessageId) {
      headers.push(`In-Reply-To: <${request.externalMessageId}>`);
      headers.push(`References: <${request.externalMessageId}>`);
    }

    return `${headers.join("\r\n")}\r\n\r\n${request.draft.body}`;
  }
}
