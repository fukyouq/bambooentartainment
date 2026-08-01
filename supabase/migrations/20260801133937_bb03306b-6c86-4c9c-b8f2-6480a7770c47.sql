CREATE POLICY "Sonk media readable by signed-in users" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sonk-media');
CREATE POLICY "Sonk members upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sonk-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners update own sonk media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sonk-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'sonk-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners or moderators delete sonk media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sonk-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.sonk_rank(auth.uid()) >= 1));