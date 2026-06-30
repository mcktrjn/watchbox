-- Migration: watches and wear_sessions
-- Creates both domain tables with RLS, moddatetime triggers, and indexes.

-- 1. Extension
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- 2. watches table
CREATE TABLE watches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  photo_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. wear_sessions table
CREATE TABLE wear_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watch_id   UUID        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ended_after_started CHECK (ended_at > started_at)
);

-- 4. moddatetime triggers
CREATE TRIGGER watches_moddatetime
  BEFORE UPDATE ON watches
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');

CREATE TRIGGER wear_sessions_moddatetime
  BEFORE UPDATE ON wear_sessions
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');

-- 5. RLS on watches
ALTER TABLE watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY watches_select ON watches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY watches_insert ON watches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY watches_update ON watches
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY watches_delete ON watches
  FOR DELETE USING (auth.uid() = user_id);

-- 6. RLS on wear_sessions
ALTER TABLE wear_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wear_sessions_select ON wear_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY wear_sessions_insert ON wear_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM watches
      WHERE watches.id = watch_id AND watches.user_id = auth.uid()
    )
  );

CREATE POLICY wear_sessions_update ON wear_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM watches
      WHERE watches.id = watch_id AND watches.user_id = auth.uid()
    )
  );

CREATE POLICY wear_sessions_delete ON wear_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Indexes
CREATE INDEX idx_watches_user_id        ON watches(user_id);
CREATE INDEX idx_wear_sessions_user_id  ON wear_sessions(user_id);
CREATE INDEX idx_wear_sessions_watch_id ON wear_sessions(watch_id);
CREATE INDEX idx_wear_sessions_started_at ON wear_sessions(started_at);
