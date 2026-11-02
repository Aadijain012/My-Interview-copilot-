import { useState } from "react";
import {
  useIssues,
  useIssueStats,
  useAssignees,
  useCreateIssue,
  useUpdateIssue,
  useAssignIssue,
  useResolveIssue,
  useCloseIssue,
} from "@/features/issues";
import {
  Button,
  Input,
  Modal,
  SkeletonTable,
  EmptyState,
  ErrorState,
} from "@/components";
import "./IssuesPage.css";

export function IssuesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [customAssigneeInput, setCustomAssigneeInput] = useState("");
  const [isCustomAssignee, setIsCustomAssignee] = useState(false);

  // Create issue form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("bug");
  const [newPriority, setNewPriority] = useState("medium");

  // Queries
  const { data: statsData } = useIssueStats();
  const { data: assignees = [] } = useAssignees();
  const { data, isLoading, isError, error, refetch } = useIssues({
    search: search.trim() || undefined,
    status: status !== "all" ? status : undefined,
    priority: priority !== "all" ? priority : undefined,
    type: type !== "all" ? type : undefined,
    page,
    limit: 10,
  });

  // Mutations
  const createMutation = useCreateIssue();
  const updateMutation = useUpdateIssue();
  const assignMutation = useAssignIssue();
  const resolveMutation = useResolveIssue();
  const closeMutation = useCloseIssue();

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    await createMutation.mutateAsync({
      title: newTitle.trim(),
      description: newDescription.trim(),
      type: newType,
      priority: newPriority,
    });

    setNewTitle("");
    setNewDescription("");
    setCreateModalOpen(false);
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!selectedIssue || !resolutionNote.trim()) return;

    await resolveMutation.mutateAsync({
      id: selectedIssue.id,
      resolutionNote: resolutionNote.trim(),
    });

    setResolutionNote("");
    setResolveModalOpen(false);
    setSelectedIssue(null);
  };

  const handleStatusChange = async (issueId, nextStatus) => {
    await updateMutation.mutateAsync({
      id: issueId,
      input: { status: nextStatus },
    });
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue((prev) =>
        prev ? { ...prev, status: nextStatus } : null,
      );
    }
  };

  const handlePriorityChange = async (issueId, nextPriority) => {
    await updateMutation.mutateAsync({
      id: issueId,
      input: { priority: nextPriority },
    });
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue((prev) =>
        prev ? { ...prev, priority: nextPriority } : null,
      );
    }
  };

  const handleClose = async (issueId) => {
    await closeMutation.mutateAsync(issueId);
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue((prev) => (prev ? { ...prev, status: "closed" } : null));
    }
  };

  const handleAssign = async (issueId, assigneeId) => {
    await assignMutation.mutateAsync({ id: issueId, assigneeId });
    if (selectedIssue && selectedIssue.id === issueId) {
      const matched = assignees.find(
        (a) =>
          a.id === assigneeId ||
          a.email === assigneeId ||
          a.name === assigneeId,
      );
      setSelectedIssue((prev) =>
        prev
          ? {
              ...prev,
              assigneeId: matched ? matched.id : null,
              assignedTo: matched
                ? matched.name || matched.email
                : assigneeId || null,
              assignee: matched
                ? {
                    id: matched.id,
                    name: matched.name,
                    email: matched.email,
                    role: matched.role,
                  }
                : null,
            }
          : null,
      );
    }
  };

  return (
    <div className="issues-page">
      {/* Header */}
      <div className="issues-page__header">
        <div>
          <h1 className="issues-page__title">Issues & Reports</h1>
          <p className="issues-page__subtitle">
            Track real system failures, session crashes, AI errors, and user
            reported issues.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
          + Report New Issue
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="issues-kpi-grid">
        <div className="issues-kpi-card">
          <span className="issues-kpi-card__label">Total Issues</span>
          <span className="issues-kpi-card__value">
            {statsData?.total ?? 0}
          </span>
        </div>
        <div className="issues-kpi-card">
          <span className="issues-kpi-card__label">Open</span>
          <span className="issues-kpi-card__value">{statsData?.open ?? 0}</span>
        </div>
        <div className="issues-kpi-card">
          <span className="issues-kpi-card__label">Investigating</span>
          <span className="issues-kpi-card__value">
            {statsData?.investigating ?? 0}
          </span>
        </div>
        <div className="issues-kpi-card">
          <span className="issues-kpi-card__label">Resolved</span>
          <span className="issues-kpi-card__value">
            {statsData?.resolved ?? 0}
          </span>
        </div>
        <div className="issues-kpi-card issues-kpi-card--critical">
          <span className="issues-kpi-card__label">Critical</span>
          <span className="issues-kpi-card__value">
            {statsData?.critical ?? 0}
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="issues-toolbar">
        <div className="issues-toolbar__search">
          <Input
            placeholder="Search by title, description, or user..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="issues-toolbar__filters">
          <select
            className="issues-toolbar__select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            className="issues-toolbar__select"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            className="issues-toolbar__select"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Types</option>
            <option value="bug">Bug</option>
            <option value="session_failure">Session Failure</option>
            <option value="ai_failure">AI Failure</option>
            <option value="recording_failure">Recording Failure</option>
            <option value="transcription_failure">Transcription Failure</option>
            <option value="user_report">User Report</option>
            <option value="operational">Operational</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="issues-table-container">
        {isLoading ? (
          <SkeletonTable rows={6} columns={[200, 100, 80, 80, 120, 100]} />
        ) : isError ? (
          <ErrorState
            title="Unable to load issues"
            message={
              error?.message || "An error occurred while fetching issues."
            }
            onRetry={() => refetch()}
          />
        ) : !data?.issues || data.issues.length === 0 ? (
          <EmptyState
            title="No issues found"
            description={
              search || status !== "all"
                ? "Try adjusting your search filters."
                : "All services and sessions are currently healthy."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setPriority("all");
                  setType("all");
                }}
              >
                Reset Filters
              </Button>
            }
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border, #e2e8f0)",
                    background: "#f8fafc",
                    color: "#64748b",
                  }}
                >
                  <th style={{ padding: "0.75rem 1rem" }}>Title</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Type</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Priority</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Reporter / User</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Assignee</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Created</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.issues.map((issue) => (
                  <tr
                    key={issue.id}
                    style={{
                      borderBottom: "1px solid var(--color-border, #e2e8f0)",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      {issue.ticketId && (
                        <span className="issue-ticket-pill">
                          {issue.ticketId}
                        </span>
                      )}
                      {issue.title || issue.subject || "Issue"}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        textTransform: "capitalize",
                      }}
                    >
                      {(issue.issueType || issue.type || "").replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        className={`issues-badge issues-badge--${issue.priority.toLowerCase()}`}
                      >
                        {issue.priority}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        className={`issues-badge issues-badge--${issue.status.toLowerCase()}`}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {issue.name ||
                        (issue.user
                          ? issue.user.name || issue.user.email
                          : issue.email || "System")}
                    </td>
                    <td
                      style={{ padding: "0.75rem 1rem" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        className={`issues-assignee-inline-select ${issue.assignee || issue.assignedTo ? "issues-assignee-inline-select--assigned" : "issues-assignee-inline-select--unassigned"}`}
                        value={
                          issue.assigneeId ||
                          (issue.assignedTo ? "__custom__" : "")
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__custom__") {
                            setSelectedIssue(issue);
                            setIsCustomAssignee(true);
                          } else {
                            handleAssign(issue.id, val ? val : null);
                          }
                        }}
                        title="Click to assign issue to staff/admin"
                      >
                        <option value="">Unassigned</option>
                        {assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name ? `${a.name}` : a.email}{" "}
                            {a.role ? `(${a.role})` : ""}
                          </option>
                        ))}
                        {issue.assignedTo && !issue.assigneeId && (
                          <option value="__custom__">
                            👤 {issue.assignedTo}
                          </option>
                        )}
                        <option value="__custom__">✏️ Custom name...</option>
                      </select>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b" }}>
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </td>
                    <td
                      style={{ padding: "0.75rem 1rem", textAlign: "right" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer Modal */}
      {selectedIssue && (
        <Modal
          isOpen={Boolean(selectedIssue)}
          title={`Issue: ${selectedIssue.title}`}
          onClose={() => setSelectedIssue(null)}
          size="lg"
        >
          <div className="issue-detail-drawer">
            <div className="issue-detail-section">
              <h4 className="issue-detail-section__title">Description</h4>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {selectedIssue.description}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <div className="issue-detail-section">
                <h4 className="issue-detail-section__title">Status</h4>
                <select
                  className="issues-toolbar__select"
                  value={selectedIssue.status.toLowerCase()}
                  onChange={(e) =>
                    handleStatusChange(selectedIssue.id, e.target.value)
                  }
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="issue-detail-section">
                <h4 className="issue-detail-section__title">Priority</h4>
                <select
                  className="issues-toolbar__select"
                  value={selectedIssue.priority.toLowerCase()}
                  onChange={(e) =>
                    handlePriorityChange(selectedIssue.id, e.target.value)
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="issue-detail-section">
              <h4 className="issue-detail-section__title">Assignee</h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <select
                    className="issues-toolbar__select"
                    style={{ minWidth: "240px" }}
                    value={
                      selectedIssue.assigneeId ||
                      (selectedIssue.assignedTo ? "__custom__" : "")
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__custom__") {
                        setIsCustomAssignee(true);
                      } else if (!val) {
                        handleAssign(selectedIssue.id, null);
                        setIsCustomAssignee(false);
                      } else {
                        handleAssign(selectedIssue.id, val);
                        setIsCustomAssignee(false);
                      }
                    }}
                  >
                    <option value="">Unassigned (None)</option>
                    <optgroup label="Administrators & Staff">
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name ? `${a.name} (${a.email})` : a.email}{" "}
                          {a.role ? `• ${a.role}` : ""}
                        </option>
                      ))}
                    </optgroup>
                    {selectedIssue.assignedTo && !selectedIssue.assigneeId && (
                      <option value="__custom__">
                        👤 {selectedIssue.assignedTo} (Custom)
                      </option>
                    )}
                    <option value="__custom__">
                      ✏️ Assign to custom person / team...
                    </option>
                  </select>

                  {(selectedIssue.assigneeId || selectedIssue.assignedTo) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        handleAssign(selectedIssue.id, null);
                        setIsCustomAssignee(false);
                        setCustomAssigneeInput("");
                      }}
                    >
                      Unassign
                    </Button>
                  )}
                </div>

                {isCustomAssignee && (
                  <div className="issues-custom-assign-box">
                    <input
                      type="text"
                      className="issues-toolbar__input"
                      style={{
                        maxWidth: "280px",
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.85rem",
                      }}
                      placeholder="Type person or team name / email..."
                      value={customAssigneeInput}
                      onChange={(e) => setCustomAssigneeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customAssigneeInput.trim()) {
                          e.preventDefault();
                          handleAssign(
                            selectedIssue.id,
                            customAssigneeInput.trim(),
                          );
                          setCustomAssigneeInput("");
                          setIsCustomAssignee(false);
                        }
                      }}
                      autoFocus
                    />

                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!customAssigneeInput.trim()}
                      onClick={() => {
                        handleAssign(
                          selectedIssue.id,
                          customAssigneeInput.trim(),
                        );
                        setCustomAssigneeInput("");
                        setIsCustomAssignee(false);
                      }}
                    >
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsCustomAssignee(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {(selectedIssue.assignee || selectedIssue.assignedTo) && (
                  <div className="issues-assignee-badge">
                    <span>👤 Assigned to:</span>
                    <strong>
                      {selectedIssue.assignee
                        ? selectedIssue.assignee.name ||
                          selectedIssue.assignee.email
                        : selectedIssue.assignedTo}
                    </strong>
                    {selectedIssue.assignee?.role && (
                      <span style={{ opacity: 0.75, fontWeight: 400 }}>
                        ({selectedIssue.assignee.role})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(selectedIssue.user || selectedIssue.email) && (
              <div className="issue-detail-section">
                <h4 className="issue-detail-section__title">
                  Impacted User / Reporter
                </h4>
                <div className="issue-detail-card">
                  <strong>
                    {selectedIssue.user?.name || selectedIssue.name || "User"}
                  </strong>{" "}
                  ({selectedIssue.user?.email || selectedIssue.email})
                  {selectedIssue.user?.id && (
                    <>
                      <br />
                      <small style={{ color: "#64748b" }}>
                        User ID: {selectedIssue.user.id}
                      </small>
                    </>
                  )}
                </div>
              </div>
            )}

            {selectedIssue.session && (
              <div className="issue-detail-section">
                <h4 className="issue-detail-section__title">
                  Associated Session
                </h4>
                <div className="issue-detail-card">
                  <strong>{selectedIssue.session.title}</strong> —{" "}
                  {selectedIssue.session.tech}
                  <br />
                  <small style={{ color: "#64748b" }}>
                    Session ID: {selectedIssue.session.id}
                  </small>
                </div>
              </div>
            )}

            {selectedIssue.resolutionNote && (
              <div className="issue-detail-section">
                <h4 className="issue-detail-section__title">Resolution Note</h4>
                <div
                  className="issue-detail-card"
                  style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
                >
                  <p style={{ margin: 0, color: "#166534" }}>
                    {selectedIssue.resolutionNote}
                  </p>
                  {selectedIssue.resolvedAt && (
                    <small style={{ color: "#15803d" }}>
                      Resolved at:{" "}
                      {new Date(selectedIssue.resolvedAt).toLocaleString()}
                    </small>
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                marginTop: "1rem",
              }}
            >
              {selectedIssue.status !== "resolved" && (
                <Button
                  variant="primary"
                  onClick={() => setResolveModalOpen(true)}
                >
                  Resolve Issue
                </Button>
              )}
              {selectedIssue.status !== "closed" && (
                <Button
                  variant="secondary"
                  onClick={() => handleClose(selectedIssue.id)}
                >
                  Close Issue
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Create Issue Modal */}
      <Modal
        isOpen={createModalOpen}
        title="Report New Product Issue"
        onClose={() => setCreateModalOpen(false)}
      >
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Issue Title *
            </label>
            <Input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Speech transcription lag on session #..."
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Type
              </label>
              <select
                className="issues-toolbar__select"
                style={{ width: "100%" }}
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="bug">Bug</option>
                <option value="session_failure">Session Failure</option>
                <option value="ai_failure">AI Failure</option>
                <option value="recording_failure">Recording Failure</option>
                <option value="transcription_failure">
                  Transcription Failure
                </option>
                <option value="user_report">User Report</option>
                <option value="operational">Operational</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Priority
              </label>
              <select
                className="issues-toolbar__select"
                style={{ width: "100%" }}
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe what occurred, steps to reproduce, or telemetry findings..."
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Submitting..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve Issue Modal */}
      <Modal
        isOpen={resolveModalOpen}
        title="Resolve Issue"
        onClose={() => setResolveModalOpen(false)}
      >
        <form
          onSubmit={handleResolve}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Resolution Summary & Fix Note *
            </label>
            <textarea
              required
              rows={4}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Explain what fixed this issue for audit trails..."
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <Button
              variant="secondary"
              type="button"
              onClick={() => setResolveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending
                ? "Resolving..."
                : "Confirm Resolution"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
