import { SectionCard } from "./SectionCard.js";
import { StatusBadge } from "./StatusBadge.js";
import type { DashboardData, DemoRunResponse } from "../types.js";
import { formatDate, toneForStatus } from "../types.js";
import { fetchJson } from "../lib/api.js";

type ReplayLabProps = {
  dashboard: DashboardData | null;
  mailboxId: string;
  loading: boolean;
  onRunAction: (
    action: () =>
      Promise<
        | void
        | {
            dashboard?: DashboardData;
            preferredMessageId?: string | null;
            resetSelection?: boolean;
          }
      >
  ) => Promise<void>;
  onLoadScenario: (scenarioId: string) => void;
  onOpenMessage: (messageId: string) => void;
};

export function ReplayLab({
  dashboard,
  mailboxId,
  loading,
  onRunAction,
  onLoadScenario,
  onOpenMessage
}: ReplayLabProps) {
  const groupedResults = {
    safe: dashboard?.scenarioResults.filter((result) => result.scenarioType === "safe") ?? [],
    ambiguous:
      dashboard?.scenarioResults.filter((result) => result.scenarioType === "ambiguous") ?? [],
    escalation:
      dashboard?.scenarioResults.filter((result) => result.scenarioType === "escalation") ?? [],
    adversarial:
      dashboard?.scenarioResults.filter((result) => result.scenarioType === "adversarial") ?? []
  };

  return (
    <SectionCard
      title="Replay Lab"
      subtitle="Expected vs actual results for the seeded scenario pack."
      actions={
        <div className="button-row">
          <button
            disabled={loading}
            onClick={() =>
              onRunAction(async () => {
                const result = await fetchJson<DemoRunResponse>("/demo/run", {
                  method: "POST",
                  body: JSON.stringify({ mailboxId })
                });
                return {
                  dashboard: result.dashboard,
                  resetSelection: true
                };
              })
            }
          >
            Reset & Run Demo Pack
          </button>
        </div>
      }
    >
      <div className="scenario-results-grid">
        {(["safe", "ambiguous", "escalation", "adversarial"] as const).map((group) => (
          <div key={group} className="scenario-group">
            <div className="scenario-group__header">
              <h3>{group}</h3>
              <StatusBadge
                label={`${groupedResults[group].filter((item) => item.isPassing).length}/${groupedResults[group].length}_passing`}
                tone={
                  groupedResults[group].every((item) => item.isPassing || !item.latestMessageId)
                    ? "good"
                    : "warn"
                }
              />
            </div>
            <div className="scenario-results-list">
              {groupedResults[group].map((result) => (
                <article key={result.scenarioId} className="scenario-result-card">
                  <div className="scenario-result-card__top">
                    <strong>{result.scenarioName}</strong>
                    <StatusBadge
                      label={result.isPassing ? "pass" : result.latestMessageId ? "needs_review" : "not_run"}
                      tone={
                        result.isPassing ? "good" : result.latestMessageId ? "warn" : "neutral"
                      }
                    />
                  </div>
                  <p className="muted">
                    Expected {result.expectedIntent} {"->"} {result.expectedDecision}
                  </p>
                  <p className="muted">
                    Actual {result.actualIntent ?? "not run"} {"->"} {result.actualDecision ?? "not run"}
                  </p>
                  <div className="badge-row">
                    <StatusBadge
                      label={result.matchesReplyContent ? "reply_grounded" : "reply_mismatch"}
                      tone={result.matchesReplyContent ? "good" : result.latestMessageId ? "warn" : "neutral"}
                    />
                    {result.latestStatus ? (
                      <StatusBadge label={result.latestStatus} tone={toneForStatus(result.latestStatus)} />
                    ) : null}
                    {result.actualConfidence !== null ? (
                      <StatusBadge
                        label={`${Math.round(result.actualConfidence * 100)}pct`}
                        tone="neutral"
                      />
                    ) : null}
                  </div>
                  <p className="muted">Last run: {formatDate(result.latestRunAt)}</p>
                  {result.failureReasons.length > 0 ? (
                    <ul className="simple-list">
                      {result.failureReasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  ) : null}
                  {result.replyPreview ? <pre className="preview-pre">{result.replyPreview}</pre> : null}
                  <div className="button-row">
                    <button
                      disabled={loading}
                      onClick={() =>
                        onRunAction(async () => {
                          await fetchJson("/scenarios/replay", {
                            method: "POST",
                            body: JSON.stringify({
                              mailboxId,
                              scenarioIds: [result.scenarioId]
                            })
                          });
                          await fetchJson("/jobs/process-pending", { method: "POST" });
                        })
                      }
                    >
                      Run
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => onLoadScenario(result.scenarioId)}
                    >
                      Load to Composer
                    </button>
                    {result.latestMessageId ? (
                      <button
                        className="button-secondary"
                        onClick={() => onOpenMessage(result.latestMessageId!)}
                      >
                        Open Message
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
