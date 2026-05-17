
-- Enums
CREATE TYPE public.host_role AS ENUM ('host', 'checker');
CREATE TYPE public.event_visibility AS ENUM ('public', 'unlisted');
CREATE TYPE public.event_status AS ENUM ('draft', 'published');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'waitlist', 'cancelled');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- hosts
CREATE TABLE public.hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  bio TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts viewable by everyone" ON public.hosts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create hosts" ON public.hosts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update host" ON public.hosts FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner can delete host" ON public.hosts FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- host_members
CREATE TABLE public.host_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.host_role NOT NULL DEFAULT 'host',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (host_id, user_id)
);
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;

-- Security definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_host_member(_host_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.host_members WHERE host_id = _host_id AND user_id = _user_id);
$$;

CREATE POLICY "Members viewable by host members" ON public.host_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host owner can insert members" ON public.host_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.hosts WHERE id = host_id AND owner_id = auth.uid()));
CREATE POLICY "Host owner can delete members" ON public.host_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hosts WHERE id = host_id AND owner_id = auth.uid()));

-- events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  venue_address TEXT,
  online_url TEXT,
  capacity INTEGER,
  cover_image_url TEXT,
  visibility public.event_visibility NOT NULL DEFAULT 'public',
  status public.event_status NOT NULL DEFAULT 'draft',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published events viewable by everyone" ON public.events FOR SELECT
  USING (status = 'published' OR public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host members can insert events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host members can update events" ON public.events FOR UPDATE TO authenticated
  USING (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host members can delete events" ON public.events FOR DELETE TO authenticated
  USING (public.is_host_member(host_id, auth.uid()));

-- rsvps
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  qr_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own rsvps; host members see all" ON public.rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_host_member(e.host_id, auth.uid())));
CREATE POLICY "Users insert own rsvps" ON public.rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rsvps" ON public.rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rsvps" ON public.rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile and host_members entry on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add host owner as a host_member with role 'host'
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.host_members (host_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'host')
  ON CONFLICT (host_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_host_created
AFTER INSERT ON public.hosts
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

CREATE INDEX events_starts_at_idx ON public.events (starts_at);
CREATE INDEX events_host_id_idx ON public.events (host_id);
CREATE INDEX rsvps_event_id_idx ON public.rsvps (event_id);
