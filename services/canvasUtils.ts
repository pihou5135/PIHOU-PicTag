
import { TagSettings } from '../types';

/**
 * Calculates the exact binary size of a base64 encoded data URL in bytes
 */
export const getByteSizeOfDataUrl = (dataUrl: string): number => {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return 0;
  const str = parts[1];
  const padding = str.endsWith('==') ? 2 : (str.endsWith('=') ? 1 : 0);
  return (str.length * 0.75) - padding;
};

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
  scale: number = 1.0,
  originalFormat: string = 'image/jpeg'
): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Canvas context not found');

  // Set canvas size
  let finalWidth = imageElement.width;
  let finalHeight = imageElement.height;

  if (settings.enableCrop) {
    finalWidth = settings.cropWidth;
    finalHeight = settings.cropHeight;
  } else if (settings.enableResize) {
    if (settings.maintainAspectRatio) {
      const ratio = Math.min(settings.resizeWidth / imageElement.width, settings.resizeHeight / imageElement.height);
      finalWidth = imageElement.width * ratio;
      finalHeight = imageElement.height * ratio;
    } else {
      finalWidth = settings.resizeWidth;
      finalHeight = settings.resizeHeight;
    }
  }

  canvas.width = finalWidth;
  canvas.height = finalHeight;

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
  } else if (settings.enableResize) {
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
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

  if (settings.enableTextWatermark && textToDraw) {
    ctx.fillText(textToDraw, x, y);
  }

  // Draw image watermark if provided
  if (settings.enableImageWatermark && settings.watermarkImage) {
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

  const format = settings.enableFormatConversion ? settings.targetFormat : originalFormat;
  let currentDataUrl = canvas.toDataURL(format, 1.0);

  if (settings.enableSizeLimit) {
    const maxBytes = settings.maxFileSizeMB * 1024 * 1024;
    let currentBytes = getByteSizeOfDataUrl(currentDataUrl);

    if (currentBytes > maxBytes) {
      let scale = 0.95;
      let iterations = 0;
      const maxIterations = 8;
      let jpegQuality = 1.0;

      // For JPEGs, lowering quality slightly first is highly effective to keep resolution 100%
      if (format === 'image/jpeg') {
        jpegQuality = 0.92;
        currentDataUrl = canvas.toDataURL(format, jpegQuality);
        currentBytes = getByteSizeOfDataUrl(currentDataUrl);
      }

      // If still too big, scale down the dimensions proportionally (等比压缩尺寸)
      while (currentBytes > maxBytes && iterations < maxIterations && scale > 0.15) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(10, Math.round(canvas.width * scale));
        tempCanvas.height = Math.max(10, Math.round(canvas.height * scale));
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.imageSmoothingEnabled = true;
          tempCtx.imageSmoothingQuality = 'high';
          tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
          currentDataUrl = tempCanvas.toDataURL(format, jpegQuality);
          currentBytes = getByteSizeOfDataUrl(currentDataUrl);
        }

        const ratio = maxBytes / currentBytes;
        if (ratio < 1) {
          scale = scale * Math.max(0.4, Math.min(0.92, Math.sqrt(ratio) * 0.97));
        } else {
          break;
        }
        iterations++;
      }
    }
  }

  return currentDataUrl;
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
