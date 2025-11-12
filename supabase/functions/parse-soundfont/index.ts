import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch a specific byte range from storage
async function fetchRange(supabase: any, bucket: string, fileName: string, start: number, end: number): Promise<ArrayBuffer> {
  const { data: urlData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileName, 60);
  
  if (!urlData?.signedUrl) {
    throw new Error('Failed to create signed URL');
  }

  const response = await fetch(urlData.signedUrl, {
    headers: {
      'Range': `bytes=${start}-${end}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch range: ${response.status}`);
  }

  return await response.arrayBuffer();
}

// Read a 32-bit little-endian integer from buffer at offset
function readUint32LE(buffer: ArrayBuffer, offset: number): number {
  const view = new DataView(buffer);
  return view.getUint32(offset, true);
}

// Read a 16-bit little-endian integer from buffer at offset
function readUint16LE(buffer: ArrayBuffer, offset: number): number {
  const view = new DataView(buffer);
  return view.getUint16(offset, true);
}

// Convert 4 bytes to string
function bytesToString(buffer: ArrayBuffer, offset: number, length: number = 4): string {
  const view = new Uint8Array(buffer);
  return String.fromCharCode(...Array.from(view.slice(offset, offset + length)));
}

// Parse SF2 file using incremental Range requests
async function parseSF2PresetsChunked(supabase: any, bucket: string, fileName: string): Promise<number[] | null> {
  const programs = new Set<number>();
  
  try {
    console.log('Starting chunked SF2 parsing...');
    
    // Step 1: Read RIFF header (12 bytes)
    const headerBuffer = await fetchRange(supabase, bucket, fileName, 0, 11);
    const riff = bytesToString(headerBuffer, 0);
    
    if (riff !== 'RIFF') {
      throw new Error('Not a valid SF2 file');
    }
    
    const fileSize = readUint32LE(headerBuffer, 4);
    const sfbk = bytesToString(headerBuffer, 8);
    
    if (sfbk !== 'sfbk') {
      throw new Error('Not a valid SF2 file (missing sfbk)');
    }
    
    console.log(`SF2 file size: ${fileSize} bytes`);
    
    // Step 2: Scan chunks to find pdta location (read in 1KB increments)
    let offset = 12;
    let pdtaOffset = -1;
    let pdtaSize = 0;
    const chunkScanSize = 1024;
    
    while (offset < fileSize && pdtaOffset === -1) {
      const scanEnd = Math.min(offset + chunkScanSize - 1, fileSize - 1);
      const chunkBuffer = await fetchRange(supabase, bucket, fileName, offset, scanEnd);
      const view = new Uint8Array(chunkBuffer);
      
      // Search for 'LIST' followed by 'pdta'
      for (let i = 0; i <= view.length - 12; i++) {
        const chunkId = bytesToString(chunkBuffer, i);
        
        if (chunkId === 'LIST') {
          const chunkSize = readUint32LE(chunkBuffer, i + 4);
          const listType = bytesToString(chunkBuffer, i + 8);
          
          if (listType === 'pdta') {
            pdtaOffset = offset + i;
            pdtaSize = chunkSize;
            console.log(`Found pdta chunk at offset ${pdtaOffset}, size: ${pdtaSize} bytes`);
            break;
          }
        }
      }
      
      offset += chunkScanSize - 12; // Overlap to avoid missing boundary chunks
    }
    
    if (pdtaOffset === -1) {
      console.error('Could not find pdta chunk');
      return null;
    }
    
    // Step 3: Download only the pdta chunk
    const pdtaEnd = pdtaOffset + 8 + pdtaSize - 1;
    const pdtaBuffer = await fetchRange(supabase, bucket, fileName, pdtaOffset, pdtaEnd);
    console.log(`Downloaded pdta chunk: ${pdtaBuffer.byteLength} bytes`);
    
    // Step 4: Find and parse phdr (preset headers) within pdta
    let phdrOffset = -1;
    let phdrSize = 0;
    
    // Search within pdta for phdr
    for (let i = 12; i <= pdtaBuffer.byteLength - 8; i++) {
      const subChunkId = bytesToString(pdtaBuffer, i);
      
      if (subChunkId === 'phdr') {
        phdrOffset = i;
        phdrSize = readUint32LE(pdtaBuffer, i + 4);
        console.log(`Found phdr at offset ${phdrOffset}, size: ${phdrSize} bytes`);
        break;
      }
    }
    
    if (phdrOffset === -1) {
      console.error('Could not find phdr chunk in pdta');
      return null;
    }
    
    // Step 5: Parse preset headers (each is 38 bytes)
    const presetCount = Math.floor(phdrSize / 38);
    console.log(`Found ${presetCount} presets`);
    
    for (let i = 0; i < presetCount - 1; i++) { // Last one is EOP
      const presetOffset = phdrOffset + 8 + (i * 38);
      const preset = readUint16LE(pdtaBuffer, presetOffset + 20);
      const bank = readUint16LE(pdtaBuffer, presetOffset + 22);
      
      // For General MIDI, we use bank 0 presets as program numbers
      if (bank === 0 && preset < 128) {
        programs.add(preset);
      }
    }
    
    console.log(`Parsed ${programs.size} GM instruments`);
    
  } catch (error) {
    console.error('Error in chunked SF2 parsing:', error);
    return null;
  }
  
  return programs.size > 0 ? Array.from(programs).sort((a, b) => a - b) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { fileName } = await req.json();

    if (!fileName) {
      return new Response(
        JSON.stringify({ error: 'fileName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing soundfont with chunked method:', fileName);

    // Parse the SF2 file using chunked Range requests
    const availablePrograms = await parseSF2PresetsChunked(supabase, 'soundfonts', fileName);

    console.log('Available programs:', availablePrograms);

    return new Response(
      JSON.stringify({ 
        success: true, 
        availableInstruments: availablePrograms,
        message: availablePrograms 
          ? `Found ${availablePrograms.length} instruments` 
          : 'Could not parse instruments, will show all'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
