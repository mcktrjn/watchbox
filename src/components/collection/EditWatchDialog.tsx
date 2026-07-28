import React, { useState, useRef, type ChangeEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
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
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Watch } from "@/lib/watches";

const MAX_NAME_LENGTH = 100;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const WATCH_PHOTOS_BUCKET = "watch-photos";

interface EditWatchDialogProps {
  watch: { id: string; name: string; photoUrl: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (watch: Watch) => void;
}

function isErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  );
}

export function EditWatchDialog({ watch, open, onOpenChange, onUpdated }: EditWatchDialogProps) {
  const [name, setName] = useState(watch.name);
  const [file, setFile] = useState<File | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset form when dialog closes
      setName(watch.name);
      setFile(null);
      setNameError(undefined);
      setFileError(undefined);
      setServerError(null);
      setSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    onOpenChange(next);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFileError(undefined);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(selected.type)) {
      setFileError("Only JPEG, PNG, or WebP images are allowed");
      e.target.value = "";
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFileError("Image must be 5MB or smaller");
      e.target.value = "";
      setFile(null);
      return;
    }

    setFile(selected);
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Name is required");
      return;
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      setNameError(`Name must be ${MAX_NAME_LENGTH} characters or fewer`);
      return;
    }
    setNameError(undefined);

    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      let uploadedPath: string | undefined;
      let oldPhotoPath: string | undefined;

      if (file) {
        const supabase = createBrowserSupabaseClient();
        if (!supabase) {
          setServerError("Supabase is not configured");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setServerError("You must be signed in to upload a photo");
          return;
        }

        const ext = MIME_TO_EXT[file.type] ?? "jpg";
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage.from(WATCH_PHOTOS_BUCKET).upload(uploadedPath, file, {
          contentType: file.type,
        });
        if (uploadError) {
          setServerError(uploadError.message);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(WATCH_PHOTOS_BUCKET).getPublicUrl(uploadedPath);
        photoUrl = publicUrl;

        // Extract old photo path for cleanup on success
        if (watch.photoUrl) {
          const oldUrl = new URL(watch.photoUrl);
          oldPhotoPath = oldUrl.pathname.replace(`/storage/v1/object/public/${WATCH_PHOTOS_BUCKET}/`, "");
        }
      }

      const response = await fetch(`/api/watches/${watch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          ...(photoUrl !== undefined ? { photoUrl } : {}),
        }),
      });

      const body: unknown = await response.json();
      if (!response.ok) {
        // Best-effort cleanup: remove the uploaded photo if update failed
        if (uploadedPath) {
          const supabase = createBrowserSupabaseClient();
          if (supabase) {
            await supabase.storage.from(WATCH_PHOTOS_BUCKET).remove([uploadedPath]);
          }
        }
        setServerError(isErrorBody(body) ? body.error : "Failed to update watch");
        return;
      }

      // Best-effort old photo cleanup after successful update
      if (oldPhotoPath) {
        const supabase = createBrowserSupabaseClient();
        if (supabase) {
          supabase.storage
            .from(WATCH_PHOTOS_BUCKET)
            .remove([oldPhotoPath])
            .catch(() => {
              // Best-effort: old photo cleanup failure is non-critical
            });
        }
      }

      onUpdated(body as Watch);
      onOpenChange(false);
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
          <DialogTitle>Edit watch</DialogTitle>
          <DialogDescription className="text-blue-100/60">Update your watch&apos;s name or photo.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <Label htmlFor="edit-watch-name" className="mb-1 text-blue-100/80">
              Name
            </Label>
            <Input
              id="edit-watch-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(undefined);
              }}
              placeholder="e.g. Seiko SKX007"
              className="border-white/20 bg-white/10 text-white placeholder-white/40"
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? <p className="mt-1 text-xs text-red-300">{nameError}</p> : null}
          </div>

          <div>
            <Label htmlFor="edit-watch-photo" className="mb-1 text-blue-100/80">
              Photo (optional)
            </Label>
            <div className="flex items-center gap-2">
              <ImagePlus className="size-4 shrink-0 text-white/40" />
              <input
                id="edit-watch-photo"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="w-full text-sm text-blue-100/80 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-white/20"
              />
            </div>
            {fileError ? <p className="mt-1 text-xs text-red-300">{fileError}</p> : null}
            {watch.photoUrl && !file ? (
              <p className="mt-1 text-xs text-blue-100/40">Current photo will be kept if no new file is selected.</p>
            ) : null}
          </div>

          <ServerError message={serverError} />

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
