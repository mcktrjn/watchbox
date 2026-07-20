-- Migration: watch-photos storage bucket
-- Creates a public-read bucket for watch photos with owner-only write RLS,
-- matching the RLS pattern used for the watches/wear_sessions tables.

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'watch-photos',
  'watch-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- 2. RLS policies on storage.objects, scoped to bucket_id = 'watch-photos'
-- No SELECT policy is needed — public buckets serve reads outside RLS.
CREATE POLICY "watch-photos_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "watch-photos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "watch-photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
