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
  const [logs, setLogs] = useState<string[]>([]);
  const log = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  useEffect(() => {
    if (!containerRef.current) {
      log('No container element available');
      return;
    }

    // Cleanup previous instance if any
    if (apiRef.current) {
      log('Destroying previous AlphaTab instance');
      apiRef.current.destroy();
      apiRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setLogs([`Init with fileUrl: ${fileUrl}`]);

    try {
      const settings = new alphaTab.Settings();
      // Fonts served locally from /public
      settings.core.fontDirectory = "/font/";
      // Minimal display just to render something reliable
      settings.display.layoutMode = alphaTab.LayoutMode.Page;
      // Basic player disabled to reduce moving parts for now
      settings.player.enablePlayer = false;
      settings.player.enableCursor = false;
      // Load file directly
      settings.core.file = fileUrl;
      log('AlphaTab settings prepared');

      const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
      apiRef.current = api;
      log('AlphaTabApi created');

      try {
        // Explicitly trigger load as a fallback (in addition to settings.core.file)
        api.load(fileUrl as any);
        log('api.load(fileUrl) called');
      } catch (e: any) {
        log(`api.load failed: ${e?.message || e}`);
      }

      const timeoutId = window.setTimeout(() => {
        log('Render timeout after 10s');
        setIsLoading(false);
        setError((prev) => prev ?? 'Render timeout: AlphaTab did not finish rendering.');
      }, 10000);

      // Events
      api.renderFinished.on(() => {
        log('renderFinished event received');
        window.clearTimeout(timeoutId);
        setIsLoading(false);
      });
      api.error.on((e: any) => {
        const message = e?.message || e?.reason || e?.toString?.() || 'Unknown error';
        log(`AlphaTab error: ${message}`);
        console.error('AlphaTab error', e);
        window.clearTimeout(timeoutId);
        setError(`AlphaTab error: ${message}`);
        setIsLoading(false);
      });
    } catch (e: any) {
      const message = e?.message || e?.toString?.() || 'Unknown init error';
      log(`Init failed: ${message}`);
      console.error('AlphaTab init failed', e);
      setError(`Player failed to initialize: ${message}`);
      setIsLoading(false);
    }

    return () => {
      log('Cleanup: destroying AlphaTab instance');
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, [fileUrl]);

  if (error) {
    return (
      <Card className="p-8 bg-card/50 backdrop-blur">
        <p className="text-destructive font-medium mb-2">{error}</p>
        <p className="text-muted-foreground text-sm mb-4">File: {fileUrl}</p>
        <pre className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{logs.join('\n') || 'No logs yet'}
        </pre>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <Card className="p-8 bg-card/50 backdrop-blur">
          <p className="text-muted-foreground mb-2">
            Loading{title ? ` ${title}` : ' tab'}...
          </p>
          <pre className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{logs.join('\n') || 'Initializing...'}
          </pre>
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
