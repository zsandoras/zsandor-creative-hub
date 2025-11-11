-- Make embed_code nullable if it isn't already
DO $$ 
BEGIN
  ALTER TABLE public.guitar_embeds
  ALTER COLUMN embed_code DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Create storage bucket for guitar files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('guitar-files', 'guitar-files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view guitar files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload guitar files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete guitar files" ON storage.objects;

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