
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.conversation_type AS ENUM ('direct', 'group', 'announcement');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'file', 'voice', 'system');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Student',
  avatar_url TEXT,
  bio TEXT,
  class_name TEXT,
  section TEXT,
  badges TEXT[] DEFAULT ARRAY[]::TEXT[],
  theme TEXT DEFAULT 'system',
  status_message TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  privacy_show_online BOOLEAN DEFAULT true,
  privacy_show_seen BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Has-role security definer (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type NOT NULL DEFAULT 'direct',
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members
CREATE TABLE public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_members_conv ON public.conversation_members(conversation_id);

-- Membership check (security definer to avoid recursion in messages RLS)
CREATE OR REPLACE FUNCTION public.is_member(_conv UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user
  )
$$;

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  type message_type NOT NULL DEFAULT 'text',
  media_url TEXT,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  forwarded_from UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  deleted_for_everyone BOOLEAN DEFAULT false,
  deleted_for_users UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at DESC);

-- Reactions
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Read receipts
CREATE TABLE public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- Typing
CREATE TABLE public.typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocks
CREATE TABLE public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- Updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins update any profile" ON public.profiles
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "Roles readable by authenticated" ON public.user_roles
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- conversations policies
CREATE POLICY "Members can view conversations" ON public.conversations
FOR SELECT TO authenticated USING (
  public.is_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Authenticated can create conversations" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators or admins update conversations" ON public.conversations
FOR UPDATE TO authenticated USING (
  auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')
);

-- conversation_members policies
CREATE POLICY "Members readable by members" ON public.conversation_members
FOR SELECT TO authenticated USING (
  public.is_member(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users join conversations as themselves" ON public.conversation_members
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own membership" ON public.conversation_members
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users leave (delete) own membership" ON public.conversation_members
FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
);

-- messages policies
CREATE POLICY "Members read messages" ON public.messages
FOR SELECT TO authenticated USING (
  public.is_member(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Members send messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND public.is_member(conversation_id, auth.uid())
);
CREATE POLICY "Senders or admins update messages" ON public.messages
FOR UPDATE TO authenticated USING (
  auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Senders or admins delete messages" ON public.messages
FOR DELETE TO authenticated USING (
  auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin')
);

-- reactions policies
CREATE POLICY "Reactions readable by chat members" ON public.message_reactions
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m
          WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid()))
);
CREATE POLICY "Users add own reactions" ON public.message_reactions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reactions" ON public.message_reactions
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reads policies
CREATE POLICY "Reads readable by members" ON public.message_reads
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m
          WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid()))
);
CREATE POLICY "Users insert own reads" ON public.message_reads
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- typing policies
CREATE POLICY "Typing readable by members" ON public.typing_indicators
FOR SELECT TO authenticated USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "Users upsert own typing" ON public.typing_indicators
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own typing" ON public.typing_indicators
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own typing" ON public.typing_indicators
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reports policies
CREATE POLICY "Users create own reports" ON public.reports
FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporter or admin views report" ON public.reports
FOR SELECT TO authenticated USING (
  auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);
CREATE POLICY "Admins update reports" ON public.reports
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);

-- blocks policies
CREATE POLICY "Users manage own blocks select" ON public.user_blocks
FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Users manage own blocks insert" ON public.user_blocks
FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users manage own blocks delete" ON public.user_blocks
FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Seed default groups
INSERT INTO public.conversations (id, type, name, description, is_default) VALUES
  ('11111111-1111-1111-1111-111111111111', 'announcement', '📢 Announcements', 'Official batch notices', true),
  ('22222222-2222-2222-2222-222222222222', 'group', 'Section A', 'Section A group chat', true),
  ('33333333-3333-3333-3333-333333333333', 'group', 'Section B', 'Section B group chat', true),
  ('44444444-4444-4444-4444-444444444444', 'group', '📚 Study Hub', 'Discuss notes and doubts', true);

-- New user trigger: profile + role + auto-join default groups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substring(NEW.id::text, 1, 4))
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  INSERT INTO public.conversation_members (conversation_id, user_id)
  SELECT id, NEW.id FROM public.conversations WHERE is_default = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
