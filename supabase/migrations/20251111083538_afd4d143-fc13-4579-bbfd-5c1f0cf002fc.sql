-- Add cover image URL column to music_tracks table
ALTER TABLE public.music_tracks
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;