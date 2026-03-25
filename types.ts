
export interface TagSettings {
  text: string;
  fontSize: number;
  color: string;
  fontWeight: string;
  opacity: number;
  marginX: number;
  marginY: number;
  usePrefix: boolean;
  watermarkImage: string | null;
  watermarkOpacity: number;
  watermarkScale: number;
  watermarkPosition: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  // New crop settings
  enableCrop: boolean;
  cropWidth: number;
  cropHeight: number;
}

export interface ImageFile {
  id: string;
  file: File;
  previewUrl: string; // Original preview
  processedUrl: string | null; // Preview with watermark
  status: 'pending' | 'processing' | 'done' | 'error';
  width: number;
  height: number;
  // New offset and scale properties for cropping
  offsetX: number;
  offsetY: number;
  scale: number;
}
