-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Page content table
CREATE TABLE public.page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT UNIQUE NOT NULL,
  title TEXT,
  content JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view page content"
  ON public.page_content FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify page content"
  ON public.page_content FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Music tracks table
CREATE TABLE public.music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  file_url TEXT NOT NULL,
  duration INTEGER,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view music tracks"
  ON public.music_tracks FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage music tracks"
  ON public.music_tracks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Food gallery table
CREATE TABLE public.food_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.food_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view food gallery"
  ON public.food_gallery FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage food gallery"
  ON public.food_gallery FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Guitar Pro embeds table
CREATE TABLE public.guitar_embeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  embed_code TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.guitar_embeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view guitar embeds"
  ON public.guitar_embeds FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage guitar embeds"
  ON public.guitar_embeds FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage buckets for files
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('music', 'music', true),
  ('food-images', 'food-images', true);

-- Storage policies for music
CREATE POLICY "Anyone can view music files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'music');

CREATE POLICY "Admins can upload music files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'music' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete music files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'music' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for food images
CREATE POLICY "Anyone can view food images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'food-images');

CREATE POLICY "Admins can upload food images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete food images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));