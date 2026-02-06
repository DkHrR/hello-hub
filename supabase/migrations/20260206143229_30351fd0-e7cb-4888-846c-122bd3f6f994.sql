
-- Table to track chunked file uploads
CREATE TABLE public.chunked_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  original_size BIGINT NOT NULL,
  chunk_size INTEGER NOT NULL DEFAULT 5242880, -- 5MB default
  total_chunks INTEGER NOT NULL,
  chunks_uploaded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'complete', 'failed')),
  bucket_name TEXT NOT NULL DEFAULT 'handwriting-samples',
  storage_prefix TEXT NOT NULL,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Table to track individual chunks
CREATE TABLE public.upload_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.chunked_uploads(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  checksum TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(upload_id, chunk_index)
);

-- Enable RLS
ALTER TABLE public.chunked_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policies for chunked_uploads
CREATE POLICY "Users can view their own uploads"
ON public.chunked_uploads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create uploads"
ON public.chunked_uploads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
ON public.chunked_uploads FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
ON public.chunked_uploads FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for upload_chunks
CREATE POLICY "Users can view their own chunks"
ON public.upload_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chunked_uploads
    WHERE id = upload_chunks.upload_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own chunks"
ON public.upload_chunks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chunked_uploads
    WHERE id = upload_chunks.upload_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own chunks"
ON public.upload_chunks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chunked_uploads
    WHERE id = upload_chunks.upload_id
    AND user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX idx_chunked_uploads_user ON public.chunked_uploads(user_id);
CREATE INDEX idx_chunked_uploads_status ON public.chunked_uploads(status);
CREATE INDEX idx_upload_chunks_upload_id ON public.upload_chunks(upload_id);

-- Updated at trigger
CREATE TRIGGER update_chunked_uploads_updated_at
BEFORE UPDATE ON public.chunked_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
