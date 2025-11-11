import React, { useRef, useState, useEffect } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import '@/styles/alphatab.css';

// Import the worker/synth files using our Vite aliases
import alphaTabWorkerUrl from '@alphatab-worker?url';
import alphaSynthWasmUrl from '@alphasynth-wasm?url';

// Define the props this component accepts
interface AlphaTabRendererProps {
  fileUrl: string; // This will be the dynamic URL from the admin panel
  onPlayerReady: (api: alphaTab.AlphaTabApi) => void; // Callback to send the API to the parent
}

const AlphaTabRenderer: React.FC<AlphaTabRendererProps> = ({ fileUrl, onPlayerReady }) => {
  const atContainer = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const [isReadyToLoad, setIsReadyToLoad] = useState(true);

  // This function handles the "click-to-init" for the sandbox
  const initializePlayer = () => {
    if (apiRef.current || !atContainer.current) return; // Prevent double-init

    const settings = new alphaTab.Settings();
    settings.core.file = fileUrl;
    settings.core.fontDirectory = "/font/";
    settings.core.useWorkers = true;
    settings.core.scriptFile = alphaTabWorkerUrl; // Set worker file
    settings.player.enablePlayer = true;
    settings.player.enableUserInteraction = true;
    settings.player.soundFont = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.6.3/dist/soundfont/sonivox.sf2";
    settings.display.layoutMode = alphaTab.LayoutMode.Page;
    settings.display.scale = 1.0;
    settings.notation.notationMode = alphaTab.NotationMode.GuitarPro;

    console.log('[AlphaTab] Initializing with worker:', alphaTabWorkerUrl);
    console.log('[AlphaTab] WASM file:', alphaSynthWasmUrl);

    // Create the AlphaTab instance
    const api = new alphaTab.AlphaTabApi(atContainer.current, settings);

    // When the player is fully ready, send the API to the parent
    api.playerReady.on(() => {
      onPlayerReady(api);
      apiRef.current = api;
      setIsReadyToLoad(false); // Hide the load button
    });

    // Handle rendering completion
    api.renderFinished.on(() => {
      console.log('[AlphaTab] Rendering finished');
    });

    // Handle errors
    api.error.on((error: any) => {
      console.error('[AlphaTab] Error:', error);
    });
  };

  // Cleanup effect to destroy the player when the component is unmounted
  useEffect(() => {
    return () => {
      if (apiRef.current) {
        apiRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* "Click-to-init" button to satisfy browser sandbox rules */}
      {isReadyToLoad && (
        <div className="flex flex-col items-center justify-center py-12">
          <Button onClick={initializePlayer} size="lg" className="gap-2">
            <Play className="h-5 w-5" />
            Load Music
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Click to load the music sheet and initialize audio playback
          </p>
        </div>
      )}

      {/* AlphaTab container */}
      <div 
        ref={atContainer} 
        className="at-wrap"
        style={{ display: isReadyToLoad ? 'none' : 'block' }}
      >
        <div className="at-content">
          <div className="at-viewport"></div>
        </div>
      </div>
    </div>
  );
};

export default AlphaTabRenderer;
