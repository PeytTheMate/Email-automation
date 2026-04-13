import { addDays, format } from "date-fns";

import type { Intent, MailboxSettings } from "../../../schemas/src/index.js";
import type { ExtractedEntities } from "../../../schemas/src/index.js";

import type { KnowledgeFact, RetrievalResult } from "../contracts.js";
import type { KnowledgeProvider } from "../contracts.js";

export async function retrieveKnowledge(args: {
  intent: Intent;
  entities: ExtractedEntities;
  mailbox: MailboxSettings;
  receivedAt: string;
  knowledgeProvider: KnowledgeProvider;
}): Promise<RetrievalResult> {
  return args.knowledgeProvider.retrieveForIntent({
    intent: args.intent,
    entities: args.entities,
    mailbox: args.mailbox,
    receivedAt: args.receivedAt
  });
}

export function resolveBusinessHoursFact(args: {
  receivedAt: string;
  entities: ExtractedEntities;
  hoursByWeekday: Record<string, string>;
}): KnowledgeFact | null {
  const receivedAt = new Date(args.receivedAt);
  const lookupDate =
    args.entities.requestedDay === "tomorrow"
      ? addDays(receivedAt, 1)
      : receivedAt;
  const weekday = format(lookupDate, "EEEE").toLowerCase();
  const hours = args.hoursByWeekday[weekday];

  if (!hours) {
    return null;
  }

  if (hours.toLowerCase() === "closed") {
    const nextOpenEntry = Object.entries(args.hoursByWeekday).find(([, value]) => value.toLowerCase() !== "closed");
    const nextOpenNote = nextOpenEntry
      ? ` The next listed open hours are ${nextOpenEntry[0]}: ${nextOpenEntry[1]}.`
      : "";

    return {
      key: `business-hours-${weekday}`,
      title: `${format(lookupDate, "EEEE")} hours`,
      value: `We are closed on ${format(lookupDate, "EEEE")}.${nextOpenNote}`,
      documentId: "business_hours"
    };
  }

  return {
    key: `business-hours-${weekday}`,
    title: `${format(lookupDate, "EEEE")} hours`,
    value:
      args.entities.requestedDay === "tomorrow"
        ? `Tomorrow, ${format(lookupDate, "EEEE")}, we are open from ${hours}.`
        : `We are open ${format(lookupDate, "EEEE")} from ${hours}.`,
    documentId: "business_hours"
  };
}
