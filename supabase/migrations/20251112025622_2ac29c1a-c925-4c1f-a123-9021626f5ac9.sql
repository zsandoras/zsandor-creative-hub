-- Create storage bucket for soundfonts
INSERT INTO storage.buckets (id, name, public)
VALUES ('soundfonts', 'soundfonts', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for soundfont access
CREATE POLICY "Soundfonts are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'soundfonts');

CREATE POLICY "Only admins can upload soundfonts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'soundfonts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update soundfonts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'soundfonts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete soundfonts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'soundfonts' AND has_role(auth.uid(), 'admin'::app_role));