-- Bucket para fotos dos usuários
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos',
  'fotos',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: cada usuário acessa apenas seus próprios arquivos
-- O primeiro segmento do path é sempre o user_id
CREATE POLICY "fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "fotos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);
