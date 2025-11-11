-- Create guest_book table for feature #14
CREATE TABLE public.guest_book (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.guest_book ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved messages
CREATE POLICY "Anyone can view approved messages"
ON public.guest_book
FOR SELECT
USING (approved = true);

-- Authenticated users can insert their own messages
CREATE POLICY "Users can create messages"
ON public.guest_book
FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Admins can manage all messages
CREATE POLICY "Admins can manage guest book"
ON public.guest_book
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_guest_book_approved ON public.guest_book(approved, created_at DESC);
CREATE INDEX idx_guest_book_created_at ON public.guest_book(created_at DESC);