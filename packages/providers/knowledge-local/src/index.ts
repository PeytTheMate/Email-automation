import { settingsRepository } from "../../../db/src/index.js";
import type { KnowledgeProvider, RetrievalResult } from "../../../core/src/contracts.js";
import type { Intent } from "../../../schemas/src/index.js";
import { resolveBusinessHoursFact } from "../../../core/src/services/retrieve-knowledge.js";

function filterDocumentsForIntent(intent: Intent, mailboxKey: string) {
  return settingsRepository
    .listKnowledgeDocuments()
    .filter(
      (document) =>
        (!document.intent || document.intent === intent) &&
        (document.mailboxKeys.length === 0 || document.mailboxKeys.includes(mailboxKey))
    );
}

export class LocalKnowledgeProvider implements KnowledgeProvider {
  providerName = "local-knowledge";

  async retrieveForIntent(args: {
    intent: Intent;
    entities: import("../../../schemas/src/index.js").ExtractedEntities;
    mailbox: import("../../../schemas/src/index.js").MailboxSettings;
    receivedAt: string;
  }): Promise<RetrievalResult> {
    const documents = filterDocumentsForIntent(args.intent, args.mailbox.key);
    const facts = [];

    if (args.intent === "business_hours_question") {
      const hoursDocument = documents.find((document) => document.key === "business-hours");
      if (hoursDocument) {
        const fact = resolveBusinessHoursFact({
          receivedAt: args.receivedAt,
          entities: args.entities,
          hoursByWeekday: hoursDocument.content.hoursByWeekday as Record<string, string>
        });
        if (fact) {
          facts.push(fact);
        }
      }
    }

    if (args.intent === "location_question") {
      const locationDocument = documents.find((document) => document.key === "business-location");
      if (locationDocument) {
        facts.push({
          key: "business-address",
          title: "Business address",
          value: locationDocument.content.fullAddress as string,
          documentId: locationDocument.id
        });
      }
    }

    if (args.intent === "booking_question" || args.intent === "reschedule_request") {
      const bookingDocument = documents.find(
        (document) =>
          document.key.startsWith("booking-instructions") || document.contentType === "booking"
      );
      if (bookingDocument) {
        facts.push({
          key: "booking-link",
          title: "Booking link",
          value: bookingDocument.content.bookingLink as string,
          documentId: bookingDocument.id
        });
        facts.push({
          key: "booking-note",
          title: "Booking note",
          value: bookingDocument.content.bookingNote as string,
          documentId: bookingDocument.id
        });
      }
    }

    if (args.intent === "required_documents_question") {
      const documentsDoc = documents.find((document) => document.key === "required-documents");
      if (documentsDoc) {
        const list = (documentsDoc.content.items as string[]).join(", ");
        facts.push({
          key: "required-documents",
          title: "Required documents",
          value: list,
          documentId: documentsDoc.id
        });
      }
    }

    if (args.intent === "parking_question") {
      const parkingDoc = documents.find((document) => document.key === "parking-notes");
      if (parkingDoc) {
        facts.push({
          key: "parking-notes",
          title: "Parking instructions",
          value: parkingDoc.content.instructions as string,
          documentId: parkingDoc.id
        });
      }
    }

    return {
      facts,
      documents,
      summary:
        facts.length > 0
          ? `Retrieved ${facts.length} trusted fact${facts.length === 1 ? "" : "s"} for ${args.intent}.`
          : `No trusted facts were available for ${args.intent}.`
    };
  }
}
