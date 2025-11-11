import { useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import { Card } from "@/components/ui/card";

interface AlphaTabPlayerProps {
  fileUrl: string;
  title?: string;
}

const AlphaTabPlayer = ({ fileUrl, title }: AlphaTabPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instance if any
    apiRef.current?.destroy();
    setIsLoading(true);
    setError(null);

    try {
      const settings = new alphaTab.Settings();
      // Fonts & soundfont served locally from /public
      settings.core.fontDirectory = "/font/";
      // Minimal display just to render something reliable
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      // Basic player disabled to reduce moving parts for now
      settings.player.enablePlayer = false;
      settings.player.enableCursor = false;
      // Load file directly
      settings.core.file = fileUrl;

      const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
      apiRef.current = api;

      // Events
      api.renderFinished.on(() => {
        setIsLoading(false);
      });
      api.error.on((e) => {
        console.error("AlphaTab error", e);
        setError("Could not render this Guitar Pro file.");
        setIsLoading(false);
      });
    } catch (e) {
      console.error("AlphaTab init failed", e);
      setError("Player failed to initialize.");
      setIsLoading(false);
    }

    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, [fileUrl]);

  if (error) {
    return (
      <Card className="p-8 text-center bg-card/50 backdrop-blur">
        <p className="text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <Card className="p-8 text-center bg-card/50 backdrop-blur">
          <p className="text-muted-foreground">
            Loading{title ? ` ${title}` : " tab"}...
          </p>
        </Card>
      )}
      <div
        ref={containerRef}
        className="w-full min-h-[600px] rounded-lg overflow-hidden border border-border bg-background"
        style={{ visibility: isLoading ? "hidden" : "visible" }}
      />
    </div>
  );
};

export default AlphaTabPlayer;
