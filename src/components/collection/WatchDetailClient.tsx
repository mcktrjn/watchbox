import React, { useState } from "react";
import { Watch, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditWatchDialog } from "@/components/collection/EditWatchDialog";
import { ServerError } from "@/components/auth/ServerError";

interface WatchData {
  id: string;
  name: string;
  photo_url: string | null;
}

interface WatchDetailClientProps {
  watch: { id: string; name: string; photoUrl: string | null };
  formattedDate: string;
}

export function WatchDetailClient({ watch: initialWatch, formattedDate }: WatchDetailClientProps) {
  const [watch, setWatch] = useState(initialWatch);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleUpdated = (updated: WatchData) => {
    setWatch({
      id: updated.id,
      name: updated.name,
      photoUrl: updated.photo_url,
    });
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/watches/${watch.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body: unknown = await response.json();
        const error =
          typeof body === "object" && body !== null && "error" in body ? String(body.error) : "Failed to delete watch";
        setDeleteError(error);
        return;
      }

      window.location.href = "/collection";
    } catch {
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="flex aspect-square items-center justify-center bg-white/5">
          {watch.photoUrl ? (
            <img src={watch.photoUrl} alt={watch.name} className="h-full w-full object-cover" />
          ) : (
            <Watch className="size-16 text-blue-100/40" />
          )}
        </div>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white">{watch.name}</h1>
          <p className="mt-1 text-sm text-blue-100/60">Added on {formattedDate}</p>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(true);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <EditWatchDialog
        watch={{ id: watch.id, name: watch.name, photoUrl: watch.photoUrl }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={handleUpdated}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Delete watch?</DialogTitle>
            <DialogDescription className="text-blue-100/60">
              This watch will be removed from your collection. Its wear history will be preserved.
            </DialogDescription>
          </DialogHeader>

          <ServerError message={deleteError} />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
