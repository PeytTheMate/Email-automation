import type { DashboardData } from "../types.js";

type RefreshDashboardOptions = {
  preferredMessageId?: string | null;
  resetSelection?: boolean;
};

export function resolveMailboxId(
  currentMailboxId: string,
  mailboxes: DashboardData["mailboxes"]
) {
  if (currentMailboxId && mailboxes.some((mailbox) => mailbox.id === currentMailboxId)) {
    return currentMailboxId;
  }

  return mailboxes[0]?.id ?? "";
}

export function resolveSelectedMessageId(args: {
  currentSelectedMessageId: string | null;
  inbox: DashboardData["inbox"];
  preferredMessageId?: string | null;
  resetSelection?: boolean;
}) {
  const availableIds = new Set(args.inbox.map((message) => message.id));

  if (args.preferredMessageId && availableIds.has(args.preferredMessageId)) {
    return args.preferredMessageId;
  }

  if (
    !args.resetSelection &&
    args.currentSelectedMessageId &&
    availableIds.has(args.currentSelectedMessageId)
  ) {
    return args.currentSelectedMessageId;
  }

  return args.inbox[0]?.id ?? null;
}

export function applyDashboardState(args: {
  currentMailboxId: string;
  currentSelectedMessageId: string | null;
  dashboard: DashboardData;
  preferredMessageId?: string | null;
  resetSelection?: boolean;
}) {
  const nextMailboxId = resolveMailboxId(args.currentMailboxId, args.dashboard.mailboxes);
  const nextSelectedMessageId = resolveSelectedMessageId({
    currentSelectedMessageId: args.currentSelectedMessageId,
    inbox: args.dashboard.inbox,
    preferredMessageId: args.preferredMessageId,
    resetSelection: args.resetSelection
  });

  return {
    nextMailboxId,
    nextSelectedMessageId
  };
}

export type { RefreshDashboardOptions };
