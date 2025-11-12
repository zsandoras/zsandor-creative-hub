import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INSTRUMENTS, INSTRUMENT_CATEGORIES, getInstrumentsByCategory } from "@/constants/instruments";

const Settings = () => {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [selectedInstrument, setSelectedInstrument] = useState<string>("40");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadDefaultInstrument();
  }, []);

  const loadDefaultInstrument = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_instrument")
        .single();

      if (error) throw error;
      if (data?.value && typeof data.value === 'object' && 'program' in data.value) {
        setSelectedInstrument(String((data.value as any).program));
      }
    } catch (error) {
      console.error("Error loading default instrument:", error);
    }
  };

  const saveDefaultInstrument = async () => {
    setIsSaving(true);
    try {
      const instrument = INSTRUMENTS.find((i) => i.program === Number(selectedInstrument));
      if (!instrument) throw new Error("Invalid instrument selected");

      const { error } = await supabase
        .from("app_settings")
        .update({
          value: { name: instrument.name, program: instrument.program },
          updated_at: new Date().toISOString(),
        })
        .eq("key", "default_instrument");

      if (error) throw error;

      toast({
        title: "Success",
        description: `Default instrument set to ${instrument.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8">
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Back to Dashboard
          </Button>
        </div>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          App Settings
        </h1>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Default Instrument</h2>
          <p className="text-muted-foreground mb-2">
            Choose the default synthesizer instrument for the Guitar Pro player.
            All 128 General MIDI instruments are available in any GM-compliant soundfont.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-900 mb-6">
            ⚠️ Note: Not all soundfonts include complete instrument sets. Upload FluidR3_GM.sf2 for full support.
          </p>

          <div className="space-y-4">
            <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
              <SelectTrigger>
                <SelectValue placeholder="Select an instrument" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {INSTRUMENT_CATEGORIES.map((category) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-xs font-semibold bg-muted/50">
                      {category}
                    </SelectLabel>
                    {getInstrumentsByCategory(category).map((instrument) => (
                      <SelectItem key={instrument.program} value={String(instrument.program)}>
                        <span className="text-xs text-muted-foreground mr-2">{instrument.program}</span>
                        {instrument.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={saveDefaultInstrument} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default Settings;
