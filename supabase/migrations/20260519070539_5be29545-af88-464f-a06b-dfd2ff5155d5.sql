-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  role public.host_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_host_idx ON public.invitations(host_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Helper to check has role on host (host or checker)
CREATE OR REPLACE FUNCTION public.has_host_role(_host_id uuid, _user_id uuid, _role public.host_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id AND role = _role
  );
$$;

-- RLS: members of host can see invitations
CREATE POLICY "Host members view invitations"
ON public.invitations FOR SELECT TO authenticated
USING (public.is_host_member(host_id, auth.uid()));

CREATE POLICY "Host role can create invitations"
ON public.invitations FOR INSERT TO authenticated
WITH CHECK (public.has_host_role(host_id, auth.uid(), 'host') AND auth.uid() = created_by);

CREATE POLICY "Host role can delete invitations"
ON public.invitations FOR DELETE TO authenticated
USING (public.has_host_role(host_id, auth.uid(), 'host'));

-- Public can look up invitation by token (needed for /invite page before joining)
CREATE POLICY "Anyone can read invitation by token"
ON public.invitations FOR SELECT TO anon, authenticated
USING (true);

-- Accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _inv public.invitations;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF _inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;

  INSERT INTO public.host_members (host_id, user_id, role)
    VALUES (_inv.host_id, _user, _inv.role)
    ON CONFLICT (host_id, user_id) DO NOTHING;

  UPDATE public.invitations SET used_at = now(), used_by = _user WHERE id = _inv.id;
  RETURN jsonb_build_object('host_id', _inv.host_id, 'role', _inv.role);
END;
$$;

-- Check-in by qr_code (any host member can check in)
CREATE OR REPLACE FUNCTION public.check_in_rsvp(_event_id uuid, _qr text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _host uuid;
  _rsvp public.rsvps;
  _profile public.profiles;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT host_id INTO _host FROM public.events WHERE id = _event_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF NOT public.is_host_member(_host, _user) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT * INTO _rsvp FROM public.rsvps WHERE event_id = _event_id AND qr_code = _qr;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF _rsvp.status <> 'going' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'wrong_status', 'status', _rsvp.status);
  END IF;
  SELECT * INTO _profile FROM public.profiles WHERE id = _rsvp.user_id;

  IF _rsvp.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already', 'checked_in_at', _rsvp.checked_in_at,
      'rsvp_id', _rsvp.id, 'name', _profile.full_name);
  END IF;

  UPDATE public.rsvps SET checked_in_at = now() WHERE id = _rsvp.id RETURNING * INTO _rsvp;
  RETURN jsonb_build_object('ok', true, 'rsvp_id', _rsvp.id, 'name', _profile.full_name,
    'checked_in_at', _rsvp.checked_in_at);
END;
$$;

-- Undo check-in (host member only)
CREATE OR REPLACE FUNCTION public.undo_check_in(_rsvp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _host uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT e.host_id INTO _host FROM public.rsvps r JOIN public.events e ON e.id = r.event_id WHERE r.id = _rsvp_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT public.is_host_member(_host, _user) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.rsvps SET checked_in_at = NULL WHERE id = _rsvp_id;
END;
$$;

-- Allow host members to read profiles of their RSVPs (for check-in list)
-- profiles is already public-readable, so we're fine.