import { nanoid } from "nanoid";

import type { DraftReply } from "../../../schemas/src/index.js";
import { draftReplySchema } from "../../../schemas/src/index.js";

import type { GenerationRequest, ModelProvider } from "../contracts.js";

export async function generateDraft(args: {
  messageId: string;
  request: GenerationRequest;
  modelProvider: ModelProvider;
}): Promise<DraftReply> {
  const result = await args.modelProvider.generateReply(args.request);
  const timestamp = new Date().toISOString();

  return draftReplySchema.parse({
    id: nanoid(),
    messageId: args.messageId,
    subject: result.subject,
    body: result.body,
    toneProfileId: args.request.toneProfile.id,
    retrievedFactKeys: args.request.retrieval.facts.map((fact) => fact.key),
    confidenceNote: result.confidenceNote,
    generationMetadata: result.generationMetadata,
    status: "generated",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}
