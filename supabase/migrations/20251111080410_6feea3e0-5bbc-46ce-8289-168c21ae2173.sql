-- Add default_instrument column to guitar_embeds table
ALTER TABLE public.guitar_embeds 
ADD COLUMN default_instrument JSONB DEFAULT '{"name": "Violin", "program": 40}'::jsonb;