// General MIDI Standard Instruments (128 programs)
// All GM-compliant soundfonts should include these instruments

export interface Instrument {
  name: string;
  program: number;
  category: string;
}

export const INSTRUMENTS: Instrument[] = [
  // Piano (0-7)
  { name: "Acoustic Grand Piano", program: 0, category: "Piano" },
  { name: "Bright Acoustic Piano", program: 1, category: "Piano" },
  { name: "Electric Grand Piano", program: 2, category: "Piano" },
  { name: "Honky-tonk Piano", program: 3, category: "Piano" },
  { name: "Electric Piano 1", program: 4, category: "Piano" },
  { name: "Electric Piano 2", program: 5, category: "Piano" },
  { name: "Harpsichord", program: 6, category: "Piano" },
  { name: "Clavinet", program: 7, category: "Piano" },

  // Chromatic Percussion (8-15)
  { name: "Celesta", program: 8, category: "Chromatic Percussion" },
  { name: "Glockenspiel", program: 9, category: "Chromatic Percussion" },
  { name: "Music Box", program: 10, category: "Chromatic Percussion" },
  { name: "Vibraphone", program: 11, category: "Chromatic Percussion" },
  { name: "Marimba", program: 12, category: "Chromatic Percussion" },
  { name: "Xylophone", program: 13, category: "Chromatic Percussion" },
  { name: "Tubular Bells", program: 14, category: "Chromatic Percussion" },
  { name: "Dulcimer", program: 15, category: "Chromatic Percussion" },

  // Organ (16-23)
  { name: "Drawbar Organ", program: 16, category: "Organ" },
  { name: "Percussive Organ", program: 17, category: "Organ" },
  { name: "Rock Organ", program: 18, category: "Organ" },
  { name: "Church Organ", program: 19, category: "Organ" },
  { name: "Reed Organ", program: 20, category: "Organ" },
  { name: "Accordion", program: 21, category: "Organ" },
  { name: "Harmonica", program: 22, category: "Organ" },
  { name: "Tango Accordion", program: 23, category: "Organ" },

  // Guitar (24-31)
  { name: "Acoustic Guitar (nylon)", program: 24, category: "Guitar" },
  { name: "Acoustic Guitar (steel)", program: 25, category: "Guitar" },
  { name: "Electric Guitar (jazz)", program: 26, category: "Guitar" },
  { name: "Electric Guitar (clean)", program: 27, category: "Guitar" },
  { name: "Electric Guitar (muted)", program: 28, category: "Guitar" },
  { name: "Overdriven Guitar", program: 29, category: "Guitar" },
  { name: "Distortion Guitar", program: 30, category: "Guitar" },
  { name: "Guitar Harmonics", program: 31, category: "Guitar" },

  // Bass (32-39)
  { name: "Acoustic Bass", program: 32, category: "Bass" },
  { name: "Electric Bass (finger)", program: 33, category: "Bass" },
  { name: "Electric Bass (pick)", program: 34, category: "Bass" },
  { name: "Fretless Bass", program: 35, category: "Bass" },
  { name: "Slap Bass 1", program: 36, category: "Bass" },
  { name: "Slap Bass 2", program: 37, category: "Bass" },
  { name: "Synth Bass 1", program: 38, category: "Bass" },
  { name: "Synth Bass 2", program: 39, category: "Bass" },

  // Strings (40-47)
  { name: "Violin", program: 40, category: "Strings" },
  { name: "Viola", program: 41, category: "Strings" },
  { name: "Cello", program: 42, category: "Strings" },
  { name: "Contrabass", program: 43, category: "Strings" },
  { name: "Tremolo Strings", program: 44, category: "Strings" },
  { name: "Pizzicato Strings", program: 45, category: "Strings" },
  { name: "Orchestral Harp", program: 46, category: "Strings" },
  { name: "Timpani", program: 47, category: "Strings" },

  // Ensemble (48-55)
  { name: "String Ensemble 1", program: 48, category: "Ensemble" },
  { name: "String Ensemble 2", program: 49, category: "Ensemble" },
  { name: "Synth Strings 1", program: 50, category: "Ensemble" },
  { name: "Synth Strings 2", program: 51, category: "Ensemble" },
  { name: "Choir Aahs", program: 52, category: "Ensemble" },
  { name: "Voice Oohs", program: 53, category: "Ensemble" },
  { name: "Synth Choir", program: 54, category: "Ensemble" },
  { name: "Orchestra Hit", program: 55, category: "Ensemble" },

  // Brass (56-63)
  { name: "Trumpet", program: 56, category: "Brass" },
  { name: "Trombone", program: 57, category: "Brass" },
  { name: "Tuba", program: 58, category: "Brass" },
  { name: "Muted Trumpet", program: 59, category: "Brass" },
  { name: "French Horn", program: 60, category: "Brass" },
  { name: "Brass Section", program: 61, category: "Brass" },
  { name: "Synth Brass 1", program: 62, category: "Brass" },
  { name: "Synth Brass 2", program: 63, category: "Brass" },

  // Reed (64-71)
  { name: "Soprano Sax", program: 64, category: "Reed" },
  { name: "Alto Sax", program: 65, category: "Reed" },
  { name: "Tenor Sax", program: 66, category: "Reed" },
  { name: "Baritone Sax", program: 67, category: "Reed" },
  { name: "Oboe", program: 68, category: "Reed" },
  { name: "English Horn", program: 69, category: "Reed" },
  { name: "Bassoon", program: 70, category: "Reed" },
  { name: "Clarinet", program: 71, category: "Reed" },

  // Pipe (72-79)
  { name: "Piccolo", program: 72, category: "Pipe" },
  { name: "Flute", program: 73, category: "Pipe" },
  { name: "Recorder", program: 74, category: "Pipe" },
  { name: "Pan Flute", program: 75, category: "Pipe" },
  { name: "Blown Bottle", program: 76, category: "Pipe" },
  { name: "Shakuhachi", program: 77, category: "Pipe" },
  { name: "Whistle", program: 78, category: "Pipe" },
  { name: "Ocarina", program: 79, category: "Pipe" },

  // Synth Lead (80-87)
  { name: "Lead 1 (square)", program: 80, category: "Synth Lead" },
  { name: "Lead 2 (sawtooth)", program: 81, category: "Synth Lead" },
  { name: "Lead 3 (calliope)", program: 82, category: "Synth Lead" },
  { name: "Lead 4 (chiff)", program: 83, category: "Synth Lead" },
  { name: "Lead 5 (charang)", program: 84, category: "Synth Lead" },
  { name: "Lead 6 (voice)", program: 85, category: "Synth Lead" },
  { name: "Lead 7 (fifths)", program: 86, category: "Synth Lead" },
  { name: "Lead 8 (bass + lead)", program: 87, category: "Synth Lead" },

  // Synth Pad (88-95)
  { name: "Pad 1 (new age)", program: 88, category: "Synth Pad" },
  { name: "Pad 2 (warm)", program: 89, category: "Synth Pad" },
  { name: "Pad 3 (polysynth)", program: 90, category: "Synth Pad" },
  { name: "Pad 4 (choir)", program: 91, category: "Synth Pad" },
  { name: "Pad 5 (bowed)", program: 92, category: "Synth Pad" },
  { name: "Pad 6 (metallic)", program: 93, category: "Synth Pad" },
  { name: "Pad 7 (halo)", program: 94, category: "Synth Pad" },
  { name: "Pad 8 (sweep)", program: 95, category: "Synth Pad" },

  // Synth Effects (96-103)
  { name: "FX 1 (rain)", program: 96, category: "Synth Effects" },
  { name: "FX 2 (soundtrack)", program: 97, category: "Synth Effects" },
  { name: "FX 3 (crystal)", program: 98, category: "Synth Effects" },
  { name: "FX 4 (atmosphere)", program: 99, category: "Synth Effects" },
  { name: "FX 5 (brightness)", program: 100, category: "Synth Effects" },
  { name: "FX 6 (goblins)", program: 101, category: "Synth Effects" },
  { name: "FX 7 (echoes)", program: 102, category: "Synth Effects" },
  { name: "FX 8 (sci-fi)", program: 103, category: "Synth Effects" },

  // Ethnic (104-111)
  { name: "Sitar", program: 104, category: "Ethnic" },
  { name: "Banjo", program: 105, category: "Ethnic" },
  { name: "Shamisen", program: 106, category: "Ethnic" },
  { name: "Koto", program: 107, category: "Ethnic" },
  { name: "Kalimba", program: 108, category: "Ethnic" },
  { name: "Bag pipe", program: 109, category: "Ethnic" },
  { name: "Fiddle", program: 110, category: "Ethnic" },
  { name: "Shanai", program: 111, category: "Ethnic" },

  // Percussive (112-119)
  { name: "Tinkle Bell", program: 112, category: "Percussive" },
  { name: "Agogo", program: 113, category: "Percussive" },
  { name: "Steel Drums", program: 114, category: "Percussive" },
  { name: "Woodblock", program: 115, category: "Percussive" },
  { name: "Taiko Drum", program: 116, category: "Percussive" },
  { name: "Melodic Tom", program: 117, category: "Percussive" },
  { name: "Synth Drum", program: 118, category: "Percussive" },
  { name: "Reverse Cymbal", program: 119, category: "Percussive" },

  // Sound Effects (120-127)
  { name: "Guitar Fret Noise", program: 120, category: "Sound Effects" },
  { name: "Breath Noise", program: 121, category: "Sound Effects" },
  { name: "Seashore", program: 122, category: "Sound Effects" },
  { name: "Bird Tweet", program: 123, category: "Sound Effects" },
  { name: "Telephone Ring", program: 124, category: "Sound Effects" },
  { name: "Helicopter", program: 125, category: "Sound Effects" },
  { name: "Applause", program: 126, category: "Sound Effects" },
  { name: "Gunshot", program: 127, category: "Sound Effects" },
];

// Get unique categories for filtering
export const INSTRUMENT_CATEGORIES = Array.from(
  new Set(INSTRUMENTS.map(i => i.category))
).sort();

// Helper function to find instrument by program number
export const getInstrumentByProgram = (program: number): Instrument | undefined => {
  return INSTRUMENTS.find(i => i.program === program);
};

// Helper function to get instruments by category
export const getInstrumentsByCategory = (category: string): Instrument[] => {
  return INSTRUMENTS.filter(i => i.category === category);
};
