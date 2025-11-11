import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Slider } from "./ui/slider";

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  open: boolean;
}

export const ImageCropper = ({ image, onCropComplete, onCancel, open }: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onCropCompleteInternal = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) return;

    const img = new Image();
    img.src = image;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, "image/jpeg");
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        
        <div className="relative h-96 bg-black rounded">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={4 / 3}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={setZoom}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Zoom</label>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(value) => setZoom(value[0])}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={createCroppedImage}>
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
