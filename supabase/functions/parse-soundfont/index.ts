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

// Parse SF2 file and detect AlphaTab-compatible instruments
async function parseSF2PresetsChunked(supabase: any, bucket: string, fileName: string): Promise<number[] | null> {
  const programs = new Set<number>();
  const incompatiblePrograms = new Set<number>();
  
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
    
    console.log('Scanning for pdta chunk from end of file...');
    
    // Step 2: The pdta chunk is at the END of SF2 files (after sdta samples)
    const scanSize = 512 * 1024; // Read last 512KB
    const scanStart = Math.max(12, fileSize - scanSize);
    
    console.log(`Reading last ${Math.floor((fileSize - scanStart) / 1024)}KB of file...`);
    
    const endBuffer = await fetchRange(supabase, bucket, fileName, scanStart, fileSize - 1);
    console.log(`Downloaded ${endBuffer.byteLength} bytes from end`);
    
    // Search for pdta chunk
    let pdtaOffset = -1;
    let pdtaSize = 0;
    
    for (let i = 0; i <= endBuffer.byteLength - 12; i++) {
      const chunkId = bytesToString(endBuffer, i);
      
      if (chunkId === 'LIST') {
        const chunkSize = readUint32LE(endBuffer, i + 4);
        const listType = bytesToString(endBuffer, i + 8);
        
        if (listType === 'pdta') {
          pdtaOffset = scanStart + i;
          pdtaSize = chunkSize;
          console.log(`✓ Found pdta chunk at offset ${pdtaOffset}, size: ${pdtaSize} bytes`);
          break;
        }
      }
    }
    
    if (pdtaOffset === -1) {
      console.error('Could not find pdta chunk');
      return null;
    }
    
    // Step 3: Download only the pdta chunk
    const pdtaEnd = pdtaOffset + 8 + pdtaSize - 1;
    const pdtaBuffer = await fetchRange(supabase, bucket, fileName, pdtaOffset, pdtaEnd);
    console.log(`Downloaded pdta chunk: ${pdtaBuffer.byteLength} bytes`);
    
    // Step 4: Find all necessary chunks within pdta
    let phdrOffset = -1, phdrSize = 0;
    let pbagOffset = -1, pbagSize = 0;
    let pgenOffset = -1, pgenSize = 0;
    let instOffset = -1, instSize = 0;
    let ibagOffset = -1, ibagSize = 0;
    let igenOffset = -1, igenSize = 0;
    let shdrOffset = -1, shdrSize = 0;
    
    for (let i = 12; i <= pdtaBuffer.byteLength - 8; i++) {
      const chunkId = bytesToString(pdtaBuffer, i);
      const chunkSize = readUint32LE(pdtaBuffer, i + 4);
      
      if (chunkId === 'phdr') { phdrOffset = i; phdrSize = chunkSize; }
      else if (chunkId === 'pbag') { pbagOffset = i; pbagSize = chunkSize; }
      else if (chunkId === 'pgen') { pgenOffset = i; pgenSize = chunkSize; }
      else if (chunkId === 'inst') { instOffset = i; instSize = chunkSize; }
      else if (chunkId === 'ibag') { ibagOffset = i; ibagSize = chunkSize; }
      else if (chunkId === 'igen') { igenOffset = i; igenSize = chunkSize; }
      else if (chunkId === 'shdr') { shdrOffset = i; shdrSize = chunkSize; }
    }
    
    console.log('Found chunks:', { phdr: !!phdrOffset, pbag: !!pbagOffset, shdr: !!shdrOffset });
    
    if (phdrOffset === -1 || shdrOffset === -1) {
      console.error('Missing required chunks');
      return null;
    }
    
    // Step 5: Parse sample headers to identify sample types
    // AlphaTab only supports type 1 (mono). Types 2 & 4 are stereo channels.
    const sampleTypes = new Map<number, number>();
    const sampleCount = Math.floor(shdrSize / 46);
    
    console.log(`Parsing ${sampleCount} samples for compatibility...`);
    for (let i = 0; i < sampleCount - 1; i++) {
      const sampleHeaderOffset = shdrOffset + 8 + (i * 46);
      const sampleType = readUint16LE(pdtaBuffer, sampleHeaderOffset + 38);
      sampleTypes.set(i, sampleType);
    }
    
    // Step 6: Build instrument to sample mapping
    const instrumentSamples = new Map<number, Set<number>>();
    
    if (instOffset !== -1 && ibagOffset !== -1 && igenOffset !== -1) {
      const instrumentCount = Math.floor(instSize / 22);
      
      for (let i = 0; i < instrumentCount - 1; i++) {
        const instHeaderOffset = instOffset + 8 + (i * 22);
        const bagStart = readUint16LE(pdtaBuffer, instHeaderOffset + 20);
        const bagEnd = i < instrumentCount - 2 
          ? readUint16LE(pdtaBuffer, instHeaderOffset + 22 + 20)
          : Math.floor(ibagSize / 4);
        
        const samples = new Set<number>();
        
        for (let bagIdx = bagStart; bagIdx < bagEnd; bagIdx++) {
          const bagOffset = ibagOffset + 8 + (bagIdx * 4);
          const genStart = readUint16LE(pdtaBuffer, bagOffset);
          const genEnd = bagIdx < Math.floor(ibagSize / 4) - 1
            ? readUint16LE(pdtaBuffer, bagOffset + 4)
            : Math.floor(igenSize / 4);
          
          for (let genIdx = genStart; genIdx < genEnd; genIdx++) {
            const genOffset = igenOffset + 8 + (genIdx * 4);
            const genOper = readUint16LE(pdtaBuffer, genOffset);
            
            if (genOper === 53) { // Sample ID
              const sampleId = readUint16LE(pdtaBuffer, genOffset + 2);
              samples.add(sampleId);
            }
          }
        }
        
        instrumentSamples.set(i, samples);
      }
    }
    
    // Step 7: Build preset to instrument mapping and check compatibility
    const presetInstruments = new Map<number, Set<number>>();
    
    if (pbagOffset !== -1 && pgenOffset !== -1) {
      const presetCount = Math.floor(phdrSize / 38);
      
      for (let i = 0; i < presetCount - 1; i++) {
        const presetHeaderOffset = phdrOffset + 8 + (i * 38);
        const preset = readUint16LE(pdtaBuffer, presetHeaderOffset + 20);
        const bank = readUint16LE(pdtaBuffer, presetHeaderOffset + 22);
        
        if (bank === 0 && preset < 128) {
          programs.add(preset);
          
          const bagStart = readUint16LE(pdtaBuffer, presetHeaderOffset + 24);
          const bagEnd = i < presetCount - 2
            ? readUint16LE(pdtaBuffer, presetHeaderOffset + 38 + 24)
            : Math.floor(pbagSize / 4);
          
          const instruments = new Set<number>();
          
          for (let bagIdx = bagStart; bagIdx < bagEnd; bagIdx++) {
            const bagOffset = pbagOffset + 8 + (bagIdx * 4);
            const genStart = readUint16LE(pdtaBuffer, bagOffset);
            const genEnd = bagIdx < Math.floor(pbagSize / 4) - 1
              ? readUint16LE(pdtaBuffer, bagOffset + 4)
              : Math.floor(pgenSize / 4);
            
            for (let genIdx = genStart; genIdx < genEnd; genIdx++) {
              const genOffset = pgenOffset + 8 + (genIdx * 4);
              const genOper = readUint16LE(pdtaBuffer, genOffset);
              
              if (genOper === 41) { // Instrument
                const instId = readUint16LE(pdtaBuffer, genOffset + 2);
                instruments.add(instId);
              }
            }
          }
          
          presetInstruments.set(preset, instruments);
          
          // Check if preset has any mono samples
          let hasMonoSample = false;
          for (const instId of instruments) {
            const samples = instrumentSamples.get(instId);
            if (samples) {
              for (const sampleId of samples) {
                const sampleType = sampleTypes.get(sampleId);
                if (sampleType === 1) { // Mono = AlphaTab compatible
                  hasMonoSample = true;
                  break;
                }
              }
            }
            if (hasMonoSample) break;
          }
          
          if (!hasMonoSample && instruments.size > 0) {
            incompatiblePrograms.add(preset);
          }
        }
      }
    }
    
    console.log(`Total presets found: ${programs.size}`);
    console.log(`Stereo-only (incompatible) presets: ${incompatiblePrograms.size}`);
    
    // Filter out incompatible programs
    const compatiblePrograms = Array.from(programs).filter(p => !incompatiblePrograms.has(p));
    
    console.log(`✅ AlphaTab-compatible instruments: ${compatiblePrograms.length}`);
    
    return compatiblePrograms.length > 0 ? compatiblePrograms.sort((a, b) => a - b) : null;
    
  } catch (error) {
    console.error('Error in chunked SF2 parsing:', error);
    return null;
  }
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
          ? `Found ${availablePrograms.length} AlphaTab-compatible instruments` 
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
