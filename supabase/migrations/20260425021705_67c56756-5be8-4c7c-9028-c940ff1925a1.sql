-- Remove broad public listing access for avatars while keeping in-app avatar visibility
UPDATE storage.buckets
SET public = false
WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');