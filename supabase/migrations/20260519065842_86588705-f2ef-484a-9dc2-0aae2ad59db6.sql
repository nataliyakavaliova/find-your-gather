INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Event covers are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-covers');

CREATE POLICY "Authenticated users can upload event covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own event covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own event covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);