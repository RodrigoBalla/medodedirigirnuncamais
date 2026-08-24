
-- Table for tracking page views, time spent, and clicks
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_path text NOT NULL,
  page_name text NOT NULL DEFAULT '',
  entered_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  referrer_path text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_page_views_user_id ON public.page_views(user_id);
CREATE INDEX idx_page_views_entered_at ON public.page_views(entered_at);
CREATE INDEX idx_page_views_page_path ON public.page_views(page_path);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Users can insert their own page views
CREATE POLICY "Users can insert own page views"
ON public.page_views FOR INSERT TO public
WITH CHECK (auth.uid() = user_id);

-- Users can update own page views (for duration/click updates)
CREATE POLICY "Users can update own page views"
ON public.page_views FOR UPDATE TO public
USING (auth.uid() = user_id);

-- Admins can view all page views
CREATE POLICY "Admins can view all page views"
ON public.page_views FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_views;
