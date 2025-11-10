-- Add file_url column to guitar_embeds table
ALTER TABLE public.guitar_embeds
ADD COLUMN file_url TEXT;

-- Make embed_code nullable since we're switching to file uploads
ALTER TABLE public.guitar_embeds
ALTER COLUMN embed_code DROP NOT NULL;

-- Create storage bucket for guitar files
INSERT INTO storage.buckets (id, name, public)
VALUES ('guitar-files', 'guitar-files', true);

-- Allow public to read guitar files
CREATE POLICY "Anyone can view guitar files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'guitar-files');

-- Only admins can upload guitar files
CREATE POLICY "Admins can upload guitar files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'guitar-files' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins can delete guitar files
CREATE POLICY "Admins can delete guitar files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'guitar-files' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);