import { StatusBadge } from "./StatusBadge.js";
import type { DashboardData } from "../types.js";
import { formatDate } from "../types.js";

type SummaryBarProps = {
  dashboard: DashboardData | null;
  autoRefresh: boolean;
  onToggleRefresh: () => void;
  onRefreshNow: () => void;
};

export function SummaryBar({
  dashboard,
  autoRefresh,
  onToggleRefresh,
  onRefreshNow
}: SummaryBarProps) {
  return (
    <section className="summary-grid">
      <article className="summary-card">
        <p>Inbox</p>
        <strong>{dashboard?.summary.inboxTotal ?? 0}</strong>
        <span>{dashboard?.summary.draftsReady ?? 0} drafts ready</span>
      </article>
      <article className="summary-card">
        <p>Escalations</p>
        <strong>{dashboard?.summary.escalated ?? 0}</strong>
        <span>{dashboard?.summary.blocked ?? 0} blocked</span>
      </article>
      <article className="summary-card">
        <p>Outbox</p>
        <strong>{dashboard?.summary.outboxTotal ?? 0}</strong>
        <span>{dashboard?.summary.autoSent ?? 0} auto-sent</span>
      </article>
      <article className="summary-card">
        <p>Queue</p>
        <strong>{dashboard?.queue.queued ?? 0}</strong>
        <span>{dashboard?.queue.processing ?? 0} processing</span>
      </article>
      <article className="summary-card summary-card--wide">
        <p>Live status</p>
        <strong>{autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}</strong>
        <div className="button-row">
          <button className="button-secondary" onClick={onToggleRefresh}>
            Toggle Refresh
          </button>
          <button className="button-secondary" onClick={onRefreshNow}>
            Refresh Now
          </button>
        </div>
        <div className="badge-row">
          <StatusBadge label={`${dashboard?.queue.failed ?? 0}_failed`} tone={(dashboard?.queue.failed ?? 0) > 0 ? "danger" : "neutral"} />
          <StatusBadge label={`${dashboard?.queue.completed ?? 0}_completed`} tone="good" />
        </div>
        <span>Last updated {formatDate(dashboard?.lastRefreshedAt)}</span>
      </article>
    </section>
  );
}
