
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS position integer;
CREATE INDEX IF NOT EXISTS rsvps_event_status_position_idx ON public.rsvps (event_id, status, position);

-- Atomic RSVP function: respects capacity, assigns waitlist position
CREATE OR REPLACE FUNCTION public.rsvp_to_event(_event_id uuid)
RETURNS public.rsvps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _capacity integer;
  _going_count integer;
  _next_pos integer;
  _existing public.rsvps;
  _new public.rsvps;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT capacity INTO _capacity FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Lock other RSVPs for this event to make capacity check race-free
  PERFORM 1 FROM public.rsvps WHERE event_id = _event_id FOR UPDATE;

  SELECT * INTO _existing FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id;

  -- Reactivate cancelled RSVP if exists
  IF FOUND THEN
    IF _existing.status IN ('going','waitlist') THEN
      RETURN _existing;
    END IF;
  END IF;

  SELECT COUNT(*) INTO _going_count FROM public.rsvps
    WHERE event_id = _event_id AND status = 'going';

  IF _capacity IS NULL OR _going_count < _capacity THEN
    IF _existing.id IS NOT NULL THEN
      UPDATE public.rsvps SET status='going', position=NULL
        WHERE id = _existing.id RETURNING * INTO _new;
    ELSE
      INSERT INTO public.rsvps (event_id, user_id, status)
        VALUES (_event_id, _user_id, 'going') RETURNING * INTO _new;
    END IF;
  ELSE
    SELECT COALESCE(MAX(position),0)+1 INTO _next_pos FROM public.rsvps
      WHERE event_id = _event_id AND status = 'waitlist';
    IF _existing.id IS NOT NULL THEN
      UPDATE public.rsvps SET status='waitlist', position=_next_pos
        WHERE id = _existing.id RETURNING * INTO _new;
    ELSE
      INSERT INTO public.rsvps (event_id, user_id, status, position)
        VALUES (_event_id, _user_id, 'waitlist', _next_pos) RETURNING * INTO _new;
    END IF;
  END IF;

  RETURN _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_to_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_rsvp(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.rsvps SET status='cancelled', position=NULL
    WHERE event_id = _event_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_rsvp(uuid) TO authenticated;

-- Auto-promote waitlist on cancellation
CREATE OR REPLACE FUNCTION public.promote_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _capacity integer;
  _going_count integer;
  _next_id uuid;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'going' THEN
    SELECT capacity INTO _capacity FROM public.events WHERE id = NEW.event_id;
    IF _capacity IS NULL THEN RETURN NEW; END IF;

    LOOP
      SELECT COUNT(*) INTO _going_count FROM public.rsvps
        WHERE event_id = NEW.event_id AND status = 'going';
      EXIT WHEN _going_count >= _capacity;

      SELECT id INTO _next_id FROM public.rsvps
        WHERE event_id = NEW.event_id AND status = 'waitlist'
        ORDER BY position ASC NULLS LAST, created_at ASC
        LIMIT 1;
      EXIT WHEN _next_id IS NULL;

      UPDATE public.rsvps SET status='going', position=NULL WHERE id = _next_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist ON public.rsvps;
CREATE TRIGGER trg_promote_waitlist
AFTER UPDATE OF status ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist();
