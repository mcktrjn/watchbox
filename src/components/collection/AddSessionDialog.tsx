import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServerError } from "@/components/auth/ServerError";
import type { WearSession } from "@/lib/wear-sessions";

interface AddSessionDialogProps {
  watchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (session: WearSession) => void;
  existingSessions: WearSession[];
}

interface TimeRange {
  start: Date;
  end: Date;
}

function sessionsOverlap(candidate: TimeRange, existing: WearSession[]): boolean {
  const candStart = candidate.start.getTime();
  const candEnd = candidate.end.getTime();

  return existing.some((s) => {
    const existingStart = new Date(s.started_at).getTime();
    const existingEnd = new Date(s.ended_at).getTime();
    return candStart < existingEnd && candEnd > existingStart;
  });
}

function isErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  );
}

export function AddSessionDialog({ watchId, open, onOpenChange, onCreated, existingSessions }: AddSessionDialogProps) {
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setDate(today);
    setStartTime("");
    setEndTime("");
    setServerError(null);
    setValidationError(null);
    setOverlapWarning(null);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  function computeOverlapWarning(dateVal: string, startVal: string, endVal: string): string | null {
    if (!dateVal || !startVal || !endVal) return null;

    const candidateStart = new Date(`${dateVal}T${startVal}:00`);
    const candidateEnd = new Date(`${dateVal}T${endVal}:00`);

    if (candidateEnd <= candidateStart) return null;

    if (sessionsOverlap({ start: candidateStart, end: candidateEnd }, existingSessions)) {
      return "This session overlaps with an existing one. You can still submit if intended.";
    }

    return null;
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    setDate(newDate);
    setValidationError(null);
    setOverlapWarning(computeOverlapWarning(newDate, startTime, endTime));
  }

  function handleStartTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newStart = e.target.value;
    setStartTime(newStart);
    setValidationError(null);
    setOverlapWarning(computeOverlapWarning(date, newStart, endTime));
  }

  function handleEndTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newEnd = e.target.value;
    setEndTime(newEnd);
    setValidationError(null);
    setOverlapWarning(computeOverlapWarning(date, startTime, newEnd));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setValidationError(null);

    if (!date || !startTime || !endTime) {
      setValidationError("All fields are required");
      return;
    }

    if (endTime <= startTime) {
      setValidationError("End time must be after start time");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/watches/${watchId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, endTime }),
      });

      const body: unknown = await response.json();

      if (!response.ok) {
        const error = isErrorBody(body) ? body.error : "Failed to create session";
        setServerError(error);
        return;
      }

      onCreated(body as WearSession);
      handleOpenChange(false);
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>Log wear session</DialogTitle>
          <DialogDescription className="text-blue-100/60">Record when you wore this watch.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-date">Date</Label>
            <Input
              id="session-date"
              type="date"
              max={today}
              value={date}
              onChange={handleDateChange}
              disabled={submitting}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-start">Start time</Label>
              <Input
                id="session-start"
                type="time"
                value={startTime}
                onChange={handleStartTimeChange}
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-end">End time</Label>
              <Input
                id="session-end"
                type="time"
                value={endTime}
                onChange={handleEndTimeChange}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <ServerError message={serverError ?? validationError} />

          {overlapWarning && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-900/30 px-3 py-2 text-sm text-amber-300">
              {overlapWarning}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                "Log Session"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
