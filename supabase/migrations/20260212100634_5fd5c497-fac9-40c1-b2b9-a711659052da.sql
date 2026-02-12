
-- Create storage bucket for research dataset uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'etdd70_dataset_raw', 
  'etdd70_dataset_raw', 
  false, 
  104857600,
  ARRAY['text/csv', 'application/json', 'application/octet-stream', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies - users can only access their own folder
CREATE POLICY "Users can upload their own datasets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'etdd70_dataset_raw'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own datasets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'etdd70_dataset_raw'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own datasets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'etdd70_dataset_raw'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
