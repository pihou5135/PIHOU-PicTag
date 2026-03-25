
import { TagSettings } from '../types';

/**
 * Loads an image from a URL or File
 */
export const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
};

/**
 * Processes a single image file with the given settings
 */
export const processImageWithWatermark = async (
  imageElement: HTMLImageElement,
  settings: TagSettings,
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1.0
): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Canvas context not found');

  // Set canvas size
  if (settings.enableCrop) {
    canvas.width = settings.cropWidth;
    canvas.height = settings.cropHeight;
  } else {
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
  }

  // Ensure the specific font weight and size is loaded before drawing
  const fontString = `${settings.fontWeight} ${settings.fontSize}px "Noto Sans SC"`;
  try {
    await document.fonts.load(fontString);
  } catch (e) {
    console.warn("Font could not be loaded, using fallback", e);
  }

  // Draw original image with high quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  if (settings.enableCrop) {
    // Draw image centered in cropped canvas with offset and scale
    const scaledWidth = imageElement.width * scale;
    const scaledHeight = imageElement.height * scale;
    const drawX = (canvas.width - scaledWidth) / 2 + offsetX;
    const drawY = (canvas.height - scaledHeight) / 2 + offsetY;
    ctx.drawImage(imageElement, drawX, drawY, scaledWidth, scaledHeight);
  } else {
    ctx.drawImage(imageElement, 0, 0);
  }

  // Configure text style
  ctx.font = fontString;
  ctx.fillStyle = settings.color;
  ctx.globalAlpha = settings.opacity;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  
  // Enable kerning for better professional spacing
  if ('fontKerning' in ctx) {
    (ctx as any).fontKerning = 'normal';
  }

  // Apply drop shadow for better readability
  const shadowOffset = Math.max(1, settings.fontSize / 24);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = shadowOffset * 2;
  ctx.shadowOffsetX = shadowOffset;
  ctx.shadowOffsetY = shadowOffset;

  // Position: Bottom Left
  const x = settings.marginX;
  const y = canvas.height - settings.marginY;

  let textToDraw = settings.text;
  if (settings.usePrefix && textToDraw && !textToDraw.startsWith('* ')) {
    textToDraw = '* ' + textToDraw;
  }

  if (textToDraw) {
    ctx.fillText(textToDraw, x, y);
  }

  // Draw image watermark if provided
  if (settings.watermarkImage) {
    try {
      const wmImg = await loadImage(settings.watermarkImage);
      
      // Reset shadow for image watermark
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      ctx.globalAlpha = settings.watermarkOpacity;
      
      const wmWidth = wmImg.width * settings.watermarkScale;
      const wmHeight = wmImg.height * settings.watermarkScale;
      
      let wmX = 0;
      let wmY = 0;
      
      switch (settings.watermarkPosition) {
        case 'center':
          wmX = (canvas.width - wmWidth) / 2;
          wmY = (canvas.height - wmHeight) / 2;
          break;
        case 'bottom-right':
          wmX = canvas.width - wmWidth - settings.marginX;
          wmY = canvas.height - wmHeight - settings.marginY;
          break;
        case 'bottom-left':
          wmX = settings.marginX;
          wmY = canvas.height - wmHeight - settings.marginY;
          break;
        case 'top-right':
          wmX = canvas.width - wmWidth - settings.marginX;
          wmY = settings.marginY;
          break;
        case 'top-left':
          wmX = settings.marginX;
          wmY = settings.marginY;
          break;
      }
      
      ctx.drawImage(wmImg, wmX, wmY, wmWidth, wmHeight);
    } catch (err) {
      console.error("Failed to draw watermark image", err);
    }
  }

  return canvas.toDataURL('image/jpeg', 1.0);
};

/**
 * Downloads a base64 or blob URL
 */
export const downloadUrl = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
