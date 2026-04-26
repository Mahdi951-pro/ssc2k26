-- Avatars bucket is public => direct URL reads work without any SELECT policy.
-- Drop the authenticated SELECT policy to prevent listing.
DROP POLICY IF EXISTS "Avatars readable by authenticated" ON storage.objects;
