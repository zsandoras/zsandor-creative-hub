-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('music_track', 'food_item', 'guitar_embed')),
  content_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add length constraint
ALTER TABLE public.comments ADD CONSTRAINT message_length CHECK (length(message) <= 1000 AND length(message) > 0);

-- Create indexes for performance
CREATE INDEX idx_comments_content ON public.comments(content_type, content_id);
CREATE INDEX idx_comments_user ON public.comments(user_id);
CREATE INDEX idx_comments_created ON public.comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view comments"
ON public.comments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create comments"
ON public.comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.comments
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
ON public.comments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Delete guest_book entries with null user_id before making it NOT NULL
DELETE FROM public.guest_book WHERE user_id IS NULL;

-- Update guest_book to make user_id NOT NULL
ALTER TABLE public.guest_book ALTER COLUMN user_id SET NOT NULL;