import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface BatchFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  disabled?: boolean;
}

export const BatchFileUpload = ({ 
  onFilesSelect, 
  accept = "image/*", 
  maxFiles = 10,
  disabled = false 
}: BatchFileUploadProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files).slice(0, maxFiles);
    setSelectedFiles(fileArray);
    onFilesSelect(fileArray);
  }, [maxFiles, onFilesSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelect(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-border",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop up to {maxFiles} files here, or click to select
        </p>
        <input
          type="file"
          multiple
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="batch-file-input"
          disabled={disabled}
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById("batch-file-input")?.click()}
          disabled={disabled}
        >
          Select Files
        </Button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{selectedFiles.length} files selected</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-secondary">
                  {file.type.startsWith("image/") && (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs truncate mt-1">{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
