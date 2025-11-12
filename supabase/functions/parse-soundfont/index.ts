import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SF2Preset {
  bank: number;
  preset: number;
  name: string;
}

// Parse SF2 file to extract available presets/instruments
function parseSF2Presets(buffer: ArrayBuffer): number[] | null {
  const view = new DataView(buffer);
  const programs = new Set<number>();
  
  try {
    // SF2 files are RIFF format
    // Look for 'RIFF' at start
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (riff !== 'RIFF') {
      throw new Error('Not a valid SF2 file');
    }

    // Find the 'pdta' (preset data) chunk
    let offset = 12; // Skip RIFF header
    const fileSize = buffer.byteLength;
    
    while (offset < fileSize - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'LIST') {
        const listType = String.fromCharCode(
          view.getUint8(offset + 8),
          view.getUint8(offset + 9),
          view.getUint8(offset + 10),
          view.getUint8(offset + 11)
        );
        
        if (listType === 'pdta') {
          // Found preset data, now look for 'phdr' (preset headers)
          let pdtaOffset = offset + 12;
          const pdtaEnd = offset + 8 + chunkSize;
          
          while (pdtaOffset < pdtaEnd - 8) {
            const subChunkId = String.fromCharCode(
              view.getUint8(pdtaOffset),
              view.getUint8(pdtaOffset + 1),
              view.getUint8(pdtaOffset + 2),
              view.getUint8(pdtaOffset + 3)
            );
            const subChunkSize = view.getUint32(pdtaOffset + 4, true);
            
            if (subChunkId === 'phdr') {
              // Parse preset headers (each is 38 bytes)
              const presetCount = Math.floor(subChunkSize / 38);
              for (let i = 0; i < presetCount - 1; i++) { // Last one is EOP
                const presetOffset = pdtaOffset + 8 + (i * 38);
                const preset = view.getUint16(presetOffset + 20, true); // Preset number
                const bank = view.getUint16(presetOffset + 22, true); // Bank number
                
                // For General MIDI, we use bank 0 presets as program numbers
                if (bank === 0 && preset < 128) {
                  programs.add(preset);
                }
              }
              break;
            }
            
            pdtaOffset += 8 + subChunkSize;
          }
          break;
        }
      }
      
      offset += 8 + chunkSize;
    }
  } catch (error) {
    console.error('Error parsing SF2:', error);
  }
  
  // If we couldn't parse or found nothing, return all programs (fallback)
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

    console.log('Downloading soundfont:', fileName);

    // Download the soundfont file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('soundfonts')
      .download(fileName);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download soundfont', details: downloadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File downloaded, parsing...');

    // Convert blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Parse the SF2 file
    const availablePrograms = parseSF2Presets(arrayBuffer);

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
