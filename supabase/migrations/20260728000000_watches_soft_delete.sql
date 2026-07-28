-- Migration: watches soft-delete
-- Adds deleted_at column to watches for soft-delete support.
-- Changes wear_sessions FK from ON DELETE CASCADE to ON DELETE NO ACTION
-- so that soft-deleting a watch preserves its wear history.

-- 1. Add deleted_at column to watches
ALTER TABLE watches ADD COLUMN deleted_at TIMESTAMPTZ;

-- 2. Change wear_sessions FK from CASCADE to NO ACTION
ALTER TABLE wear_sessions DROP CONSTRAINT wear_sessions_watch_id_fkey;
ALTER TABLE wear_sessions ADD CONSTRAINT wear_sessions_watch_id_fkey
  FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE NO ACTION;

-- 3. Index for efficient filtering on deleted_at
CREATE INDEX idx_watches_deleted_at ON watches(deleted_at);