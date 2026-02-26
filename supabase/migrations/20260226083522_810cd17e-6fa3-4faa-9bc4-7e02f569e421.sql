
-- Create storage bucket for exercise images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exercise-images', 'exercise-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- Allow anyone to read exercise images (public bucket)
CREATE POLICY "Anyone can view exercise images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-images');

-- Allow anyone to upload exercise images
CREATE POLICY "Anyone can upload exercise images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exercise-images');

-- Allow anyone to update exercise images
CREATE POLICY "Anyone can update exercise images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'exercise-images');

-- Allow anyone to delete exercise images
CREATE POLICY "Anyone can delete exercise images"
ON storage.objects FOR DELETE
USING (bucket_id = 'exercise-images');
