-- STORIES
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','image')),
  content text,
  media_url text,
  background text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','section')),
  section text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_stories_active ON public.stories (expires_at DESC);
CREATE INDEX idx_stories_author ON public.stories (author_id);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories visible by visibility rules" ON public.stories
FOR SELECT TO authenticated
USING (
  expires_at > now()
  AND (
    visibility = 'public'
    OR (visibility = 'section' AND section = public.get_user_section(auth.uid()))
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users post own stories" ON public.stories
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author or admin delete stories" ON public.stories
FOR DELETE TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- STORY VIEWS
CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);
CREATE INDEX idx_story_views_story ON public.story_views (story_id);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Author or viewer can see views" ON public.story_views
FOR SELECT TO authenticated
USING (
  viewer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users record own view" ON public.story_views
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = viewer_id);

-- STORY REACTIONS
CREATE TABLE public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id, emoji)
);
CREATE INDEX idx_story_reactions_story ON public.story_reactions (story_id);

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions readable by story visibility" ON public.story_reactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_id
      AND s.expires_at > now()
      AND (
        s.visibility = 'public'
        OR (s.visibility = 'section' AND s.section = public.get_user_section(auth.uid()))
        OR s.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

CREATE POLICY "Users add own reactions" ON public.story_reactions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reactions" ON public.story_reactions
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Storage bucket for story media (re-uses chat-media if exists; create stories bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Story media public read" ON storage.objects
FOR SELECT USING (bucket_id = 'stories');

CREATE POLICY "Users upload own story media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own story media" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);