import { useCallback } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && isValidGPFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidGPFile(file)) {
      onFileSelect(file);
    }
  };

  const isValidGPFile = (file: File) => {
    const validExtensions = [".gp", ".gp3", ".gp4", ".gp5", ".gpx", ".gp7"];
    return validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
  };

  return (
    <Card className="p-12 bg-card/50 backdrop-blur border-2 border-dashed border-border hover:border-primary/50 transition-colors">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="flex flex-col items-center justify-center gap-4 text-center cursor-pointer"
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <Upload className="h-16 w-16 text-primary" />
        <div>
          <h3 className="text-xl font-semibold mb-2">Upload Guitar Pro File</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supported: .gp, .gp3, .gp4, .gp5, .gpx, .gp7
          </p>
        </div>
        <input
          id="file-input"
          type="file"
          accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    </Card>
  );
};

export default FileUpload;
