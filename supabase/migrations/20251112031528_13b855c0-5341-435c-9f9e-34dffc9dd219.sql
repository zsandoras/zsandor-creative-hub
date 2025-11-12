-- Add available_instruments column to app_settings to store which MIDI programs are available in each soundfont
-- This will be a JSON array of program numbers (0-127)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN app_settings.metadata IS 'Additional metadata for settings. For soundfont_url, stores available_instruments array.';