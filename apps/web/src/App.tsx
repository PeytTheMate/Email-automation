import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { ReplayLab } from "./components/ReplayLab.js";
import { SectionCard } from "./components/SectionCard.js";
import { StatusBadge } from "./components/StatusBadge.js";
import { SummaryBar } from "./components/SummaryBar.js";
import { fetchJson } from "./lib/api.js";
import { applyDashboardState } from "./lib/dashboard-state.js";
import type { DashboardData, DemoRunResponse, MessageDetail } from "./types.js";
import {
  EMPTY_FORM,
  formatDate,
  toneForPolicy,
  toneForStatus
} from "./types.js";

const EMPTY_FILTERS = {
  search: "",
  status: "all",
  action: "all",
  scenarioType: "all"
};

type InboxFilters = {
  search: string;
  status: string;
  action: string;
  scenarioType: string;
};

type DashboardRefreshOptions = {
  preferredMessageId?: string | null;
  resetSelection?: boolean;
  dashboard?: DashboardData;
};

type ActionResult = void | DashboardRefreshOptions;

export function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [mailboxId, setMailboxId] = useState("");
  const [actingUserId, setActingUserId] = useState("");
  const [manualForm, setManualForm] = useState(EMPTY_FORM);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [draftBody, setDraftBody] = useState("");
  const [activeTab, setActiveTab] = useState<"inbox" | "lab" | "outbox" | "settings">("inbox");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS);

  const refreshDashboard = useEffectEvent(async (options: DashboardRefreshOptions = {}) => {
    const data = options.dashboard ?? (await fetchJson<DashboardData>("/dashboard"));
    const nextState = applyDashboardState({
      currentMailboxId: mailboxId,
      currentSelectedMessageId: selectedMessageId,
      dashboard: data,
      preferredMessageId: options.preferredMessageId,
      resetSelection: options.resetSelection
    });

    setDashboard(data);
    setMailboxId(nextState.nextMailboxId);
    setSelectedMessageId(nextState.nextSelectedMessageId);

    return nextState;
  });

  const refreshDetail = useEffectEvent(async (messageId: string) => {
    const data = await fetchJson<MessageDetail>(`/messages/${messageId}`);
    setDetail(data);
    setDraftBody((current) => current || data.draft?.body || "");
  });

  useEffect(() => {
    refreshDashboard().catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard.");
    });
  }, [refreshDashboard]);

  useEffect(() => {
    if (!selectedMessageId) {
      setDetail(null);
      setDraftBody("");
      return;
    }

    if (detail?.message.id && detail.message.id !== selectedMessageId) {
      setDetail(null);
      setDraftBody("");
    }
  }, [detail?.message.id, selectedMessageId]);

  useEffect(() => {
    if (!selectedMessageId) {
      setDetail(null);
      return;
    }

    refreshDetail(selectedMessageId).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "Failed to load message.");
    });
  }, [selectedMessageId, refreshDetail]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      refreshDashboard()
        .then(({ nextSelectedMessageId }) => {
          if (nextSelectedMessageId) {
            return refreshDetail(nextSelectedMessageId);
          }

          setDetail(null);
          return undefined;
        })
        .catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, refreshDashboard, refreshDetail]);

  const filteredInbox = useMemo(() => {
    const rows = dashboard?.inbox ?? [];
    return rows.filter((message) => {
      const searchText = `${message.senderName ?? ""} ${message.senderEmail} ${message.subject}`.toLowerCase();
      const scenario = dashboard?.scenarios.find((item) => item.id === message.scenarioId);
      const matchesSearch =
        !filters.search || searchText.includes(filters.search.toLowerCase());
      const matchesStatus = filters.status === "all" || message.status === filters.status;
      const matchesAction =
        filters.action === "all" || message.policyDecision?.action === filters.action;
      const matchesScenarioType =
        filters.scenarioType === "all" || scenario?.scenarioType === filters.scenarioType;
      const matchesMailbox = !mailboxId || message.mailboxId === mailboxId;

      return matchesSearch && matchesStatus && matchesAction && matchesScenarioType && matchesMailbox;
    });
  }, [dashboard, filters, mailboxId]);

  const mailboxUsers = useMemo(
    () => (dashboard?.users ?? []).filter((user) => user.mailboxId === mailboxId),
    [dashboard?.users, mailboxId]
  );

  useEffect(() => {
    if (mailboxUsers.length === 0) {
      setActingUserId("");
      return;
    }

    if (!mailboxUsers.some((user) => user.id === actingUserId)) {
      setActingUserId(mailboxUsers[0]?.id ?? "");
    }
  }, [actingUserId, mailboxUsers]);

  async function runAction(action: () => Promise<ActionResult>) {
    setLoading(true);
    setError(null);
    try {
      const actionResult = await action();
      const { nextSelectedMessageId } = await refreshDashboard(actionResult ?? {});
      if (nextSelectedMessageId) {
        await refreshDetail(nextSelectedMessageId);
      } else {
        setDetail(null);
        setDraftBody("");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function loadScenarioIntoComposer(scenarioId: string) {
    const scenario = dashboard?.scenarios.find((item) => item.id === scenarioId);
    if (!scenario) {
      return;
    }

    setManualForm({
      senderEmail: scenario.senderEmail,
      senderName: scenario.senderName,
      subject: scenario.subject,
      rawBody: scenario.body,
      threadId: ""
    });
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Local-first email automation sandbox</p>
          <h1>Email Operations Console</h1>
          <p className="hero__copy">
            Live inbox sandbox with queue visibility, replayable scenario scoring, grounded drafts,
            and a safe local outbox for reviewable demos.
          </p>
        </div>
        <div className="hero__actions">
          <button
            onClick={() =>
              runAction(async () => {
                const result = await fetchJson<DemoRunResponse>("/demo/run", {
                  method: "POST",
                  body: JSON.stringify({ mailboxId })
                });
                setActiveTab("lab");
                return {
                  dashboard: result.dashboard,
                  resetSelection: true
                };
              })
            }
            disabled={loading}
          >
            Run Demo Pack
          </button>
          <button
            onClick={() =>
              runAction(async () => {
                await fetchJson("/admin/seed", { method: "POST" });
                return {
                  resetSelection: true
                };
              })
            }
            disabled={loading}
          >
            Reset Sandbox
          </button>
          <button
            onClick={() =>
              runAction(async () => {
                await fetchJson("/jobs/process-pending", { method: "POST" });
              })
            }
            disabled={loading}
          >
            Process Pending
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <SummaryBar
        dashboard={dashboard}
        autoRefresh={autoRefresh}
        onToggleRefresh={() => setAutoRefresh((current) => !current)}
        onRefreshNow={() => {
          refreshDashboard()
            .then(({ nextSelectedMessageId }) => {
              if (nextSelectedMessageId) {
                return refreshDetail(nextSelectedMessageId);
              }

              setDetail(null);
              return undefined;
            })
            .catch(() => undefined);
        }}
      />

      <div className="top-grid">
        <SectionCard title="Manual Inbox Simulator" subtitle="Paste or load a sample email and process it end to end.">
          <div className="form-grid">
            <label>
              Mailbox
              <select value={mailboxId} onChange={(event) => setMailboxId(event.target.value)}>
                {(dashboard?.mailboxes ?? []).map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Acting user
              <select value={actingUserId} onChange={(event) => setActingUserId(event.target.value)}>
                {mailboxUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sender email
              <input value={manualForm.senderEmail} onChange={(event) => setManualForm((current) => ({ ...current, senderEmail: event.target.value }))} />
            </label>
            <label>
              Sender name
              <input value={manualForm.senderName} onChange={(event) => setManualForm((current) => ({ ...current, senderName: event.target.value }))} />
            </label>
            <label className="form-grid__full">
              Subject
              <input value={manualForm.subject} onChange={(event) => setManualForm((current) => ({ ...current, subject: event.target.value }))} />
            </label>
            <label className="form-grid__full">
              Existing thread ID
              <input value={manualForm.threadId} onChange={(event) => setManualForm((current) => ({ ...current, threadId: event.target.value }))} placeholder="Leave blank to start a new thread" />
            </label>
            <label className="form-grid__full">
              Email body
              <textarea rows={7} value={manualForm.rawBody} onChange={(event) => setManualForm((current) => ({ ...current, rawBody: event.target.value }))} />
            </label>
          </div>
          <div className="button-row">
            <button
              disabled={loading || !manualForm.subject || !manualForm.rawBody}
              onClick={() =>
                runAction(async () => {
                  const created = await fetchJson<{ message: { id: string } }>("/messages/manual", {
                    method: "POST",
                    body: JSON.stringify({
                      mailboxId,
                      actorUserId: actingUserId || null,
                      ...manualForm
                    })
                  });
                  await fetchJson("/jobs/process-pending", { method: "POST" });
                  setManualForm(EMPTY_FORM);
                  setActiveTab("inbox");
                  return {
                    preferredMessageId: created.message.id
                  };
                })
              }
            >
              Submit Mock Email
            </button>
            <button className="button-secondary" onClick={() => setManualForm(EMPTY_FORM)}>
              Clear
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Scenario Controls"
          subtitle="Select scenarios to replay, or load one into the manual composer."
          actions={
            <div className="button-row">
              <button
                disabled={loading || selectedScenarioIds.length === 0}
                onClick={() =>
                  runAction(async () => {
                    await fetchJson("/scenarios/replay", {
                      method: "POST",
                      body: JSON.stringify({
                        mailboxId,
                        scenarioIds: selectedScenarioIds
                      })
                    });
                    await fetchJson("/jobs/process-pending", { method: "POST" });
                    setActiveTab("lab");
                  })
                }
              >
                Replay Selected
              </button>
              <button
                className="button-secondary"
                disabled={selectedScenarioIds.length !== 1}
                onClick={() => loadScenarioIntoComposer(selectedScenarioIds[0]!)}
              >
                Load Into Composer
              </button>
            </div>
          }
        >
          <div className="scenario-list">
            {(dashboard?.scenarios ?? []).map((scenario) => {
              const selected = selectedScenarioIds.includes(scenario.id);
              return (
                <label key={scenario.id} className={`scenario-card ${selected ? "scenario-card--selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      setSelectedScenarioIds((current) =>
                        event.target.checked
                          ? [...current, scenario.id]
                          : current.filter((value) => value !== scenario.id)
                      )
                    }
                  />
                  <div>
                    <div className="scenario-card__top">
                      <strong>{scenario.name}</strong>
                      {scenario.demoReady ? <StatusBadge label="demo_ready" tone="good" /> : null}
                    </div>
                    <p>{scenario.scenarioType}</p>
                    <small>
                      {scenario.expectedIntent} {"->"} {scenario.expectedDecision}
                    </small>
                  </div>
                </label>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <nav className="tab-strip">
        <button className={activeTab === "inbox" ? "active" : ""} onClick={() => setActiveTab("inbox")}>Inbox</button>
        <button className={activeTab === "lab" ? "active" : ""} onClick={() => setActiveTab("lab")}>Replay Lab</button>
        <button className={activeTab === "outbox" ? "active" : ""} onClick={() => setActiveTab("outbox")}>Outbox</button>
        <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>Settings</button>
      </nav>

      {activeTab === "inbox" ? (
        <div className="inbox-layout">
          <SectionCard title="Inbox" subtitle={`${filteredInbox.length} visible message(s)`}>
            <div className="filters-grid">
              <label className="filters-grid__wide">
                Search
                <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Sender, email, or subject" />
              </label>
              <label>
                Status
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="new">New</option>
                  <option value="processing">Processing</option>
                  <option value="draft_ready">Draft ready</option>
                  <option value="auto_sent">Auto sent</option>
                  <option value="sent">Sent</option>
                  <option value="escalated">Escalated</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <label>
                Decision
                <select value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="draft_only">Draft only</option>
                  <option value="auto_send_allowed">Auto send allowed</option>
                  <option value="escalate">Escalate</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <label>
                Scenario Type
                <select value={filters.scenarioType} onChange={(event) => setFilters((current) => ({ ...current, scenarioType: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="safe">Safe</option>
                  <option value="ambiguous">Ambiguous</option>
                  <option value="escalation">Escalation</option>
                  <option value="adversarial">Adversarial</option>
                </select>
              </label>
            </div>
            <div className="message-list">
              {filteredInbox.map((message) => (
                <button key={message.id} className={`message-row ${selectedMessageId === message.id ? "message-row--selected" : ""}`} onClick={() => { setSelectedMessageId(message.id); setDraftBody(""); }}>
                  <div className="message-row__top">
                    <strong>{message.senderName ?? message.senderEmail}</strong>
                    <span>{formatDate(message.receivedAt)}</span>
                  </div>
                  <div className="message-row__subject">{message.subject}</div>
                  <div className="message-row__meta">
                    <StatusBadge label={message.status} tone={toneForStatus(message.status)} />
                    {message.policyDecision ? <StatusBadge label={message.policyDecision.action} tone={toneForPolicy(message.policyDecision.action)} /> : null}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="detail-stack">
            <SectionCard title="Email Detail" subtitle={detail ? detail.message.subject : "Select an email to inspect"}>
              {detail ? (
                <div className="detail-grid">
                  <div><h3>Original message</h3><pre>{detail.message.rawBody}</pre></div>
                  <div><h3>Normalized content</h3><pre>{detail.message.normalizedBodyText ?? "Waiting for processing."}</pre></div>
                  <div>
                    <h3>Thread context</h3>
                    {detail.thread ? (
                      <>
                        <p><strong>Thread:</strong> {detail.thread.subject}</p>
                        <p><strong>Status:</strong> {detail.thread.status}</p>
                        <p><strong>Current intent:</strong> {detail.thread.currentIntent ?? "Not set yet"}</p>
                        {detail.threadMessages.length > 0 ? (
                          <ul className="simple-list">
                            {detail.threadMessages.map((message) => (
                              <li key={message.id}>
                                <strong>{message.subject}</strong>: {message.senderName ?? message.senderEmail} at {formatDate(message.receivedAt)} ({message.status})
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : <p className="muted">This message is not attached to a saved thread yet.</p>}
                  </div>
                  <div>
                    <h3>Classification</h3>
                    {detail.classification ? (
                      <>
                        <p><strong>Intent:</strong> {detail.classification.intent}</p>
                        <p><strong>Confidence:</strong> {(detail.classification.confidence * 100).toFixed(0)}%</p>
                        <p><strong>Provider:</strong> {detail.classification.providerUsed}</p>
                        <p>{detail.classification.reasoningSummary}</p>
                        <div className="badge-row">{detail.classification.riskFlags.map((flag) => <StatusBadge key={flag} label={flag} tone="danger" />)}</div>
                      </>
                    ) : <p className="muted">Waiting for processing.</p>}
                  </div>
                  <div>
                    <h3>Extracted entities</h3>
                    <pre>{JSON.stringify(detail.classification?.extractedEntities ?? {}, null, 2)}</pre>
                    {detail.actingUser ? (
                      <>
                        <p><strong>Acting user:</strong> {detail.actingUser.name} ({detail.actingUser.role})</p>
                        <p><strong>User overrides:</strong> tone `{detail.actingUser.toneProfileOverrideId ?? "none"}`, automation `{detail.actingUser.automationProfileOverrideId ?? "none"}`</p>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : <p className="muted">Choose an inbox item to inspect normalization, routing, and policy output.</p>}
            </SectionCard>

            <SectionCard title="Suggested Reply" subtitle="Grounded only in structured local knowledge.">
              {detail ? (
                <div className="detail-grid">
                  <div>
                    <h3>Policy decision</h3>
                    {detail.policyDecision ? (
                      <>
                        <div className="badge-row">
                          <StatusBadge label={detail.policyDecision.action} tone={toneForPolicy(detail.policyDecision.action)} />
                          <StatusBadge label={detail.policyDecision.riskLevel} tone="neutral" />
                        </div>
                        <p>{detail.policyDecision.rationale}</p>
                        <p><strong>Rules:</strong> {detail.policyDecision.triggeredRules.join(", ")}</p>
                        {detail.policyDecision.escalationTarget ? <p><strong>Escalation target:</strong> {detail.policyDecision.escalationTarget}</p> : null}
                      </>
                    ) : <p className="muted">Waiting for processing.</p>}
                  </div>
                  <div>
                    <h3>Retrieved facts</h3>
                    {detail.retrieval?.facts?.length ? (
                      <ul className="simple-list">
                        {detail.retrieval.facts.map((fact) => <li key={fact.key}><strong>{fact.title}:</strong> {fact.value}</li>)}
                      </ul>
                    ) : <p className="muted">No draftable facts were retrieved for this message.</p>}
                  </div>
                  <div className="detail-grid__full">
                    <h3>Draft response</h3>
                    {detail.draft ? (
                      <>
                        <p><strong>Generation:</strong> {detail.draft.generationMetadata.provider} ({detail.draft.generationMetadata.mode})</p>
                        <p><strong>Tone profile:</strong> {detail.draft.toneProfileId ?? "Unknown"}</p>
                        <p><strong>Confidence note:</strong> {detail.draft.confidenceNote}</p>
                        <textarea rows={10} value={draftBody || detail.draft.body} onChange={(event) => setDraftBody(event.target.value)} />
                        <div className="button-row">
                          <button
                            disabled={loading}
                            onClick={() =>
                              runAction(async () => {
                                await fetchJson(`/drafts/${detail.draft?.id}/send`, {
                                  method: "POST",
                                  body: JSON.stringify({ editedBody: draftBody || detail.draft?.body })
                                });
                                setActiveTab("outbox");
                              })
                            }
                          >
                            Approve & Send
                          </button>
                          <button
                            className="button-secondary"
                            disabled={loading}
                            onClick={() =>
                              runAction(async () => {
                                await fetchJson(`/drafts/${detail.draft?.id}/reject`, {
                                  method: "POST",
                                  body: JSON.stringify({ reason: "Rejected from the review dashboard." })
                                });
                              })
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : <p className="muted">No draft was created because the policy routed this message to escalation or blocking.</p>}
                  </div>
                </div>
              ) : <p className="muted">Select a message to review the grounded reply path.</p>}
            </SectionCard>

            <SectionCard title="Audit Trail" subtitle="Processing timestamps, providers, and policy reasons.">
              {detail ? (
                <div className="audit-list">
                  {detail.audit.map((event) => (
                    <article key={event.id} className="audit-item">
                      <div className="audit-item__top">
                        <strong>{event.eventType.replaceAll("_", " ")}</strong>
                        <span>{formatDate(event.createdAt)}</span>
                      </div>
                      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                    </article>
                  ))}
                </div>
              ) : <p className="muted">Select a message to inspect the full processing chain.</p>}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "lab" ? (
        <ReplayLab
          dashboard={dashboard}
          mailboxId={mailboxId}
          loading={loading}
          onRunAction={runAction}
          onLoadScenario={(scenarioId) => {
            loadScenarioIntoComposer(scenarioId);
            setActiveTab("inbox");
          }}
          onOpenMessage={(messageId) => {
            setSelectedMessageId(messageId);
            setActiveTab("inbox");
          }}
        />
      ) : null}

      {activeTab === "outbox" ? (
        <SectionCard title="Local Outbox" subtitle={`${dashboard?.outbox.length ?? 0} replies stored locally`}>
          <div className="outbox-list">
            {(dashboard?.outbox ?? []).map((item) => (
              <article key={item.id} className="outbox-item">
                <div className="outbox-item__top">
                  <strong>{item.subject}</strong>
                  <StatusBadge label={item.deliveryMode} tone="good" />
                </div>
                <p>{item.recipientEmail}</p>
                <p>{formatDate(item.sentAt)}</p>
                <pre className="preview-pre">{item.body}</pre>
                <div className="button-row">
                  <button className="button-secondary" onClick={() => { setSelectedMessageId(item.messageId); setActiveTab("inbox"); }}>
                    Open Source Message
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "settings" && dashboard ? (
        <div className="settings-grid">
          <SectionCard title="Mailboxes" subtitle="Seeded local configuration snapshot for mailbox-level defaults">
            <ul className="simple-list">
              {dashboard.mailboxes.map((mailbox) => <li key={mailbox.id}><strong>{mailbox.displayName}</strong>: tone `{mailbox.defaultToneProfileId}`, automation `{mailbox.defaultAutomationProfileId}`, mock auto-send {mailbox.allowMockAutoSend ? "enabled" : "disabled"}.</li>)}
            </ul>
          </SectionCard>
          <SectionCard title="Automation Profiles" subtitle="Seeded thresholds and approval modes">
            <ul className="simple-list">
              {dashboard.automationProfiles.map((profile) => <li key={profile.id}><strong>{profile.name}</strong>: {profile.approvalMode}, draft threshold {profile.confidenceThresholdDraft}, auto-send threshold {profile.confidenceThresholdAutoSend}.</li>)}
            </ul>
          </SectionCard>
          <SectionCard title="Users" subtitle="Mailbox assignees and override settings">
            <ul className="simple-list">
              {dashboard.users.map((user) => <li key={user.id}><strong>{user.name}</strong>: {user.role} on `{user.mailboxId}`, tone override `{user.toneProfileOverrideId ?? "none"}`, automation override `{user.automationProfileOverrideId ?? "none"}`.</li>)}
            </ul>
          </SectionCard>
          <SectionCard title="Tone Profiles" subtitle="Approved voice presets from local seed data">
            <ul className="simple-list">
              {dashboard.toneProfiles.map((profile) => <li key={profile.id}><strong>{profile.name}</strong>: {profile.description}</li>)}
            </ul>
          </SectionCard>
          <SectionCard title="Knowledge Documents" subtitle="Local structured business facts, filtered by mailbox bindings at runtime">
            <ul className="simple-list">
              {dashboard.knowledgeDocuments.map((document) => <li key={document.id}><strong>{document.title}</strong>: {document.contentType} from {document.source}</li>)}
            </ul>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
