-- Ensure public read on avatars bucket and clean upload/update policies
CREATE POLICY "Avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
