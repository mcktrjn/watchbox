import { useState } from "react";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServerError } from "@/components/auth/ServerError";
import type { WearSession } from "@/lib/wear-sessions";

interface WearSessionListProps {
  watchId: string;
  sessions: WearSession[];
  onSessionsChange: (sessions: WearSession[]) => void;
}

function formatDuration(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDateString(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeString(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  );
}

export function WearSessionList({ watchId, sessions, onSessionsChange }: WearSessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEditing(session: WearSession) {
    setEditingId(session.id);
    setEditDate(toLocalDateString(session.started_at));
    setEditStart(toLocalTimeString(session.started_at));
    setEditEnd(toLocalTimeString(session.ended_at));
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDate("");
    setEditStart("");
    setEditEnd("");
    setError(null);
  }

  async function handleSave(sessionId: string) {
    setError(null);

    if (!editDate || !editStart || !editEnd) {
      setError("All fields are required");
      return;
    }

    if (editEnd <= editStart) {
      setError("End time must be after start time");
      return;
    }

    setSavingId(sessionId);

    try {
      const response = await fetch(`/api/watches/${watchId}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editDate, startTime: editStart, endTime: editEnd }),
      });

      const body: unknown = await response.json();

      if (!response.ok) {
        const msg = isErrorBody(body) ? body.error : "Failed to update session";
        setError(msg);
        return;
      }

      const updated = body as WearSession;
      onSessionsChange(sessions.map((s) => (s.id === sessionId ? updated : s)));
      cancelEditing();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(sessionId: string) {
    setError(null);
    setDeletingId(sessionId);

    try {
      const response = await fetch(`/api/watches/${watchId}/sessions/${sessionId}`, {
        method: "DELETE",
      });

      // 404 means session is already gone — treat as success
      if (response.status === 404) {
        onSessionsChange(sessions.filter((s) => s.id !== sessionId));
        setConfirmDeleteId(null);
        return;
      }

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        const msg = isErrorBody(body) ? body.error : "Failed to delete session";
        setError(msg);
        return;
      }

      onSessionsChange(sessions.filter((s) => s.id !== sessionId));
      setConfirmDeleteId(null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div key={session.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
          {editingId === session.id ? (
            /* Edit mode */
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-blue-100/60">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => {
                    setEditDate(e.target.value);
                  }}
                  disabled={savingId === session.id}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-100/60">Start</label>
                  <Input
                    type="time"
                    value={editStart}
                    onChange={(e) => {
                      setEditStart(e.target.value);
                    }}
                    disabled={savingId === session.id}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-100/60">End</label>
                  <Input
                    type="time"
                    value={editEnd}
                    onChange={(e) => {
                      setEditEnd(e.target.value);
                    }}
                    disabled={savingId === session.id}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              <ServerError message={error} />

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cancelEditing} disabled={savingId === session.id}>
                  <X className="size-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleSave(session.id)} disabled={savingId === session.id}>
                  {savingId === session.id ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check className="size-4" />
                      Save
                    </span>
                  )}
                </Button>
              </div>
            </div>
          ) : confirmDeleteId === session.id ? (
            /* Delete confirmation */
            <div className="space-y-3">
              <p className="text-sm text-blue-100/80">Delete this wear session?</p>
              <ServerError message={error} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setError(null);
                  }}
                  disabled={deletingId === session.id}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(session.id)}
                  disabled={deletingId === session.id}
                >
                  {deletingId === session.id ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    "Delete"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{formatDate(session.started_at)}</p>
                <p className="text-sm text-blue-100/60">
                  {formatTime(session.started_at)} – {formatTime(session.ended_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium whitespace-nowrap text-blue-300">
                  {formatDuration(session.started_at, session.ended_at)}
                </span>
                <button
                  onClick={() => {
                    startEditing(session);
                  }}
                  className="text-blue-100/40 transition-colors hover:text-blue-100/80"
                  aria-label="Edit session"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => {
                    setConfirmDeleteId(session.id);
                    setError(null);
                  }}
                  className="text-red-400/40 transition-colors hover:text-red-400/80"
                  aria-label="Delete session"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
