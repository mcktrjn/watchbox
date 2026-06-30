-- RLS isolation test for watches and wear_sessions.
-- Runs inside a transaction and rolls back — leaves no test data.
-- Usage: psql $LOCAL_DB_URL -f supabase/tests/rls.sql

BEGIN;

-- ── Seed two synthetic users (as postgres superuser, bypassing RLS) ────────────
INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'user_a@test.local',
    'test-encrypted-password',
    '{}',
    '{}',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'user_b@test.local',
    'test-encrypted-password',
    '{}',
    '{}',
    FALSE,
    NOW(),
    NOW()
  );

-- ── User A session ─────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SET LOCAL ROLE authenticated;

INSERT INTO watches (id, user_id, name)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Seiko SKX007'
);

DO $$ BEGIN
  ASSERT (SELECT COUNT(*) FROM watches) = 1,
    'User A must see exactly 1 watch after inserting their own';
END $$;

-- ── User B session ─────────────────────────────────────────────────────────────
RESET ROLE;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SET LOCAL ROLE authenticated;

DO $$ BEGIN
  ASSERT (SELECT COUNT(*) FROM watches) = 0,
    'User B must see 0 watches — RLS must isolate User A''s rows';
END $$;

-- User B attempts to create a wear_session on User A's watch (ownership check must block it)
DO $$
DECLARE
  raised BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO wear_sessions (user_id, watch_id, started_at, ended_at)
    VALUES (
      '00000000-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      NOW(),
      NOW() + INTERVAL '1 hour'
    );
  EXCEPTION WHEN others THEN
    raised := TRUE;
  END;
  ASSERT raised,
    'RLS ownership check must block User B from inserting a wear_session on User A''s watch';
END $$;

ROLLBACK;
