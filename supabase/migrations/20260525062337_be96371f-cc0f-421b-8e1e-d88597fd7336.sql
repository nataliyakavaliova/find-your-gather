
DO $$
DECLARE
  v_user uuid;
  v_host uuid;
  v_upcoming uuid;
  v_past uuid;
  i int;
  v_rsvp_user uuid;
  v_wait int := 0;
  v_names text[] := ARRAY['Anna Kowalska','Piotr Nowak','Maria Wiśniewska','Tomasz Lewandowski','Katarzyna Wójcik','Michał Kamiński','Agnieszka Zielińska','Jakub Szymański','Magdalena Woźniak','Krzysztof Dąbrowski','Ewa Kozłowska','Adam Jankowski'];
  v_email text;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = 'demo-host@example.com';
  IF v_user IS NULL THEN
    v_user := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
      'demo-host@example.com', crypt('DemoHost2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Host"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user,
      jsonb_build_object('sub', v_user::text, 'email', 'demo-host@example.com', 'email_verified', true),
      'email', v_user::text, now(), now(), now());
  END IF;
  INSERT INTO public.profiles (id, full_name) VALUES (v_user, 'Demo Host')
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_host FROM public.hosts WHERE slug = 'warsaw-tech-community';
  IF v_host IS NULL THEN
    INSERT INTO public.hosts (owner_id, name, slug, bio, contact_email, logo_url)
    VALUES (v_user, 'Warsaw Tech Community', 'warsaw-tech-community',
      'Monthly meetups for developers and tech enthusiasts in Warsaw',
      'hello@warsaw-tech.example',
      'https://api.dicebear.com/7.x/shapes/svg?seed=warsaw-tech&backgroundColor=6366f1,8b5cf6&backgroundType=gradientLinear'
    ) RETURNING id INTO v_host;
  END IF;
  INSERT INTO public.host_members (host_id, user_id, role)
  VALUES (v_host, v_user, 'host') ON CONFLICT (host_id, user_id) DO NOTHING;

  SELECT id INTO v_upcoming FROM public.events
    WHERE host_id = v_host AND title = 'React & TypeScript Workshop';
  IF v_upcoming IS NULL THEN
    INSERT INTO public.events (host_id, title, description, starts_at, ends_at, timezone, venue_address, capacity, cover_image_url, status, visibility, is_paid)
    VALUES (v_host, 'React & TypeScript Workshop',
      E'Spend an evening leveling up your frontend stack with us.\n\nWe''ll cover advanced TypeScript patterns for React: discriminated unions for component props, type-safe context, generic hooks, and how to lean on the compiler instead of fighting it.\n\nFormat: 30 min talk, 90 min hands-on workshop, 30 min Q&A and networking. Snacks and drinks provided. Bring your laptop.\n\nLevel: intermediate. You should be comfortable writing React components and basic TypeScript.',
      (date_trunc('day', now() + interval '14 days') + interval '18 hours'),
      (date_trunc('day', now() + interval '14 days') + interval '21 hours'),
      'Europe/Warsaw', 'Innovation Hub, Koszykowa 54, Warsaw', 30,
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80',
      'published', 'public', false);
  END IF;

  SELECT id INTO v_past FROM public.events
    WHERE host_id = v_host AND title = 'AI in Production: Lessons Learned';
  IF v_past IS NULL THEN
    INSERT INTO public.events (host_id, title, description, starts_at, ends_at, timezone, venue_address, capacity, cover_image_url, status, visibility, is_paid)
    VALUES (v_host, 'AI in Production: Lessons Learned',
      E'A panel night with engineers who ship LLM-powered products to real users.\n\nWe talked about evaluation harnesses, cost control, prompt versioning, fallbacks for flaky model calls, and the operational pain of running RAG at scale.\n\nThanks to everyone who came out — slides and recordings will be shared in the community Slack.',
      (date_trunc('day', now() - interval '30 days') + interval '18 hours'),
      (date_trunc('day', now() - interval '30 days') + interval '21 hours'),
      'Europe/Warsaw', 'Innovation Hub, Koszykowa 54, Warsaw', 40,
      'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=1200&q=80',
      'published', 'public', false)
    RETURNING id INTO v_past;

    FOR i IN 1..12 LOOP
      v_email := 'demo-attendee-' || i || '@example.com';
      SELECT id INTO v_rsvp_user FROM auth.users WHERE email = v_email;
      IF v_rsvp_user IS NULL THEN
        v_rsvp_user := gen_random_uuid();
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', v_rsvp_user, 'authenticated', 'authenticated',
          v_email, crypt('DemoAttendee2026!', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', v_names[i]),
          now(), now(), '', '', '', ''
        );
        INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        VALUES (gen_random_uuid(), v_rsvp_user,
          jsonb_build_object('sub', v_rsvp_user::text, 'email', v_email, 'email_verified', true),
          'email', v_rsvp_user::text, now(), now(), now());
      END IF;
      INSERT INTO public.profiles (id, full_name) VALUES (v_rsvp_user, v_names[i])
      ON CONFLICT (id) DO NOTHING;

      IF i <= 6 THEN
        INSERT INTO public.rsvps (event_id, user_id, status, checked_in_at)
        VALUES (v_past, v_rsvp_user, 'going', now() - interval '30 days' + interval '18 hours' + (i || ' minutes')::interval);
      ELSIF i <= 9 THEN
        INSERT INTO public.rsvps (event_id, user_id, status)
        VALUES (v_past, v_rsvp_user, 'going');
      ELSE
        v_wait := v_wait + 1;
        INSERT INTO public.rsvps (event_id, user_id, status, position)
        VALUES (v_past, v_rsvp_user, 'waitlist', v_wait);
      END IF;
    END LOOP;

    INSERT INTO public.feedback (event_id, user_id, rating, comment)
    SELECT v_past, r.user_id, f.rating, f.comment FROM (
      SELECT user_id, row_number() OVER (ORDER BY created_at) AS rn
      FROM public.rsvps WHERE event_id = v_past AND status = 'going'
    ) r
    JOIN (VALUES
      (1, 5, 'Brilliant panel — the cost control section alone was worth coming for.'),
      (2, 4, 'Loved the honest "what didn''t work" stories. Would attend again.'),
      (3, 5, 'Great mix of speakers. Venue was a little warm but the content made up for it.')
    ) AS f(rn, rating, comment) ON f.rn = r.rn;
  END IF;
END $$;
