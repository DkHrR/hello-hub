import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Admin client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // === INITIALIZE UPLOAD ===
    if (action === 'init') {
      const { fileName, fileSize, mimeType, chunkSize = 5 * 1024 * 1024, metadata = {} } = await req.json();
      
      if (!fileName || !fileSize) {
        return new Response(
          JSON.stringify({ error: 'fileName and fileSize are required' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const totalChunks = Math.ceil(fileSize / chunkSize);
      const storagePrefix = `etdd70_dataset_raw/${user.id}/${Date.now()}_${fileName}`;

      console.log(`[chunked-upload] Init: ${fileName}, size: ${fileSize}, chunks: ${totalChunks}, prefix: ${storagePrefix}`);

      const { data: upload, error: insertError } = await supabaseAdmin
        .from('chunked_uploads')
        .insert({
          user_id: user.id,
          file_name: fileName,
          original_size: fileSize,
          chunk_size: chunkSize,
          total_chunks: totalChunks,
          status: 'uploading',
          storage_prefix: storagePrefix,
          mime_type: mimeType || 'application/octet-stream',
          metadata
        })
        .select()
        .single();

      if (insertError) {
        console.error('[chunked-upload] Init error:', insertError);
        throw insertError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          uploadId: upload.id,
          totalChunks,
          chunkSize,
          storagePrefix
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // === UPLOAD CHUNK ===
    if (action === 'chunk') {
      const formData = await req.formData();
      const uploadId = formData.get('uploadId') as string;
      const chunkIndex = parseInt(formData.get('chunkIndex') as string);
      const file = formData.get('chunk') as File;

      if (!uploadId || isNaN(chunkIndex) || !file) {
        return new Response(
          JSON.stringify({ error: 'uploadId, chunkIndex, and chunk file are required' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Verify upload belongs to user
      const { data: upload, error: fetchError } = await supabaseAdmin
        .from('chunked_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !upload) {
        return new Response(
          JSON.stringify({ error: 'Upload not found' }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (upload.status === 'complete') {
        return new Response(
          JSON.stringify({ error: 'Upload already complete' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Upload chunk to storage
      const chunkPath = `${upload.storage_prefix}/chunk_${String(chunkIndex).padStart(5, '0')}`;
      const arrayBuffer = await file.arrayBuffer();

      console.log(`[chunked-upload] Uploading chunk ${chunkIndex}/${upload.total_chunks - 1} to ${chunkPath}, size: ${arrayBuffer.byteLength}`);

      const { error: storageError } = await supabaseAdmin.storage
        .from(upload.bucket_name)
        .upload(chunkPath, arrayBuffer, {
          contentType: 'application/octet-stream',
          upsert: true
        });

      if (storageError) {
        console.error('[chunked-upload] Storage error:', storageError);
        throw storageError;
      }

      // Record chunk in database
      const { error: chunkInsertError } = await supabaseAdmin
        .from('upload_chunks')
        .insert({
          upload_id: uploadId,
          chunk_index: chunkIndex,
          storage_path: chunkPath,
          size: arrayBuffer.byteLength
        });

      if (chunkInsertError) {
        console.error('[chunked-upload] Chunk insert error:', chunkInsertError);
        throw chunkInsertError;
      }

      // Update chunks_uploaded count
      const { data: chunkCount } = await supabaseAdmin
        .from('upload_chunks')
        .select('id', { count: 'exact' })
        .eq('upload_id', uploadId);

      const uploaded = chunkCount?.length || 0;
      const isComplete = uploaded >= upload.total_chunks;

      const updateData: Record<string, unknown> = { chunks_uploaded: uploaded };
      if (isComplete) {
        updateData.status = 'complete';
        updateData.completed_at = new Date().toISOString();
      }

      await supabaseAdmin
        .from('chunked_uploads')
        .update(updateData)
        .eq('id', uploadId);

      console.log(`[chunked-upload] Chunk ${chunkIndex} done. Progress: ${uploaded}/${upload.total_chunks}. Complete: ${isComplete}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          chunkIndex,
          chunksUploaded: uploaded,
          totalChunks: upload.total_chunks,
          isComplete
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // === GET UPLOAD STATUS ===
    if (action === 'status') {
      const uploadId = url.searchParams.get('uploadId');
      
      if (!uploadId) {
        // List all uploads for user
        const { data: uploads, error } = await supabaseAdmin
          .from('chunked_uploads')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ uploads }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: upload, error } = await supabaseAdmin
        .from('chunked_uploads')
        .select('*, upload_chunks(*)')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .single();

      if (error || !upload) {
        return new Response(
          JSON.stringify({ error: 'Upload not found' }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ upload }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // === RETRIEVE / REASSEMBLE FILE ===
    if (action === 'retrieve') {
      const uploadId = url.searchParams.get('uploadId');
      
      if (!uploadId) {
        return new Response(
          JSON.stringify({ error: 'uploadId is required' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: upload, error } = await supabaseAdmin
        .from('chunked_uploads')
        .select('*, upload_chunks(*)')
        .eq('id', uploadId)
        .eq('user_id', user.id)
        .eq('status', 'complete')
        .single();

      if (error || !upload) {
        return new Response(
          JSON.stringify({ error: 'Completed upload not found' }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Sort chunks by index
      const sortedChunks = (upload.upload_chunks as Array<{ chunk_index: number; storage_path: string }>)
        .sort((a, b) => a.chunk_index - b.chunk_index);

      // Download and concatenate all chunks
      const parts: Uint8Array[] = [];
      for (const chunk of sortedChunks) {
        const { data: chunkData, error: downloadError } = await supabaseAdmin.storage
          .from(upload.bucket_name)
          .download(chunk.storage_path);

        if (downloadError || !chunkData) {
          console.error(`[chunked-upload] Failed to download chunk ${chunk.chunk_index}:`, downloadError);
          throw new Error(`Failed to download chunk ${chunk.chunk_index}`);
        }

        parts.push(new Uint8Array(await chunkData.arrayBuffer()));
      }

      // Combine all parts
      const totalSize = parts.reduce((sum, p) => sum + p.length, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const part of parts) {
        combined.set(part, offset);
        offset += part.length;
      }

      console.log(`[chunked-upload] Retrieved file ${upload.file_name}, total size: ${totalSize}`);

      return new Response(combined, {
        status: 200,
        headers: {
          'Content-Type': upload.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${upload.file_name}"`,
          'Content-Length': String(totalSize),
          ...corsHeaders
        }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: init, chunk, status, retrieve' }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[chunked-upload] Error:', errMsg);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
