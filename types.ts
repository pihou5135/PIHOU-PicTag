
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
  // Toggles
  enableTextWatermark: boolean;
  enableImageWatermark: boolean;
  // New crop settings
  enableCrop: boolean;
  cropWidth: number;
  cropHeight: number;
  // New resize settings
  enableResize: boolean;
  resizeWidth: number;
  resizeHeight: number;
  maintainAspectRatio: boolean;
  // New format settings
  enableFormatConversion: boolean;
  targetFormat: 'image/jpeg' | 'image/png';
  // New size limit settings
  enableSizeLimit: boolean;
  maxFileSizeMB: number;
}

export interface Preset {
  id: string;
  name: string;
  settings: TagSettings;
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
