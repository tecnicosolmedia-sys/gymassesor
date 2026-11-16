DROP POLICY IF EXISTS "Anyone can update exercise images" ON storage.objects;

CREATE POLICY "Users can update own exercise images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'exercise-images'
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Anyone can delete exercise images" ON storage.objects;

CREATE POLICY "Users can delete own exercise images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND owner_id = (SELECT auth.uid()::text)
);