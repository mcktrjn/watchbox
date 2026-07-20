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

-- User A creates a storage object in their own folder
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES (
  'watch-photos',
  '00000000-0000-0000-0000-000000000001/test-photo-a.jpg',
  '00000000-0000-0000-0000-000000000001'
);

DO $$ BEGIN
  ASSERT (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'watch-photos' AND name LIKE '00000000-0000-0000-0000-000000000001/%') = 1,
    'User A must be able to insert a storage object into their own folder';
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

-- User B must not be able to INSERT into User A's storage folder
DO $$
DECLARE
  raised BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES (
      'watch-photos',
      '00000000-0000-0000-0000-000000000001/malicious-upload.jpg',
      '00000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN others THEN
    raised := TRUE;
  END;
  ASSERT raised,
    'RLS must block User B from inserting into User A''s storage folder';
END $$;

-- User B must not be able to UPDATE User A's storage object
DO $$
DECLARE
  raised BOOLEAN := FALSE;
BEGIN
  BEGIN
    UPDATE storage.objects
    SET name = '00000000-0000-0000-0000-000000000001/renamed-by-b.jpg'
    WHERE bucket_id = 'watch-photos'
      AND name = '00000000-0000-0000-0000-000000000001/test-photo-a.jpg';
  EXCEPTION WHEN others THEN
    raised := TRUE;
  END;
  ASSERT raised,
    'RLS must block User B from updating User A''s storage object';
END $$;

-- User B must not be able to DELETE User A's storage object
DO $$
DECLARE
  raised BOOLEAN := FALSE;
BEGIN
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'watch-photos'
      AND name = '00000000-0000-0000-0000-000000000001/test-photo-a.jpg';
  EXCEPTION WHEN others THEN
    raised := TRUE;
  END;
  ASSERT raised,
    'RLS must block User B from deleting User A''s storage object';
END $$;

ROLLBACK;
