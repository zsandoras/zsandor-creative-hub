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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INSTRUMENTS = [
  { name: "Violin", program: 40 },
  { name: "Viola", program: 41 },
  { name: "Cello", program: 42 },
  { name: "Contrabass", program: 43 },
  { name: "Acoustic Guitar (nylon)", program: 24 },
  { name: "Acoustic Guitar (steel)", program: 25 },
  { name: "Electric Guitar (jazz)", program: 26 },
  { name: "Electric Guitar (clean)", program: 27 },
  { name: "Electric Guitar (muted)", program: 28 },
  { name: "Overdriven Guitar", program: 29 },
  { name: "Distortion Guitar", program: 30 },
  { name: "Guitar Harmonics", program: 31 },
  { name: "Acoustic Bass", program: 32 },
  { name: "Electric Bass (finger)", program: 33 },
  { name: "Electric Bass (pick)", program: 34 },
  { name: "Fretless Bass", program: 35 },
  { name: "Piano", program: 0 },
  { name: "Electric Piano", program: 4 },
  { name: "Harpsichord", program: 6 },
  { name: "Organ", program: 16 },
  { name: "Accordion", program: 21 },
  { name: "Strings Ensemble", program: 48 },
  { name: "Synth Strings", program: 50 },
  { name: "Choir Aahs", program: 52 },
  { name: "Trumpet", program: 56 },
  { name: "Trombone", program: 57 },
  { name: "French Horn", program: 60 },
  { name: "Saxophone", program: 65 },
  { name: "Flute", program: 73 },
  { name: "Synth Lead", program: 80 },
  { name: "Synth Pad", program: 88 },
];

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
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          App Settings
        </h1>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Default Instrument</h2>
          <p className="text-muted-foreground mb-6">
            Choose the default synthesizer instrument for the Guitar Pro player
          </p>

          <div className="space-y-4">
            <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
              <SelectTrigger>
                <SelectValue placeholder="Select an instrument" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {INSTRUMENTS.map((instrument) => (
                  <SelectItem key={instrument.program} value={String(instrument.program)}>
                    {instrument.name}
                  </SelectItem>
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
