
import type { TagSettings } from '../types';
import { getImageGeometry } from './coverage.ts';

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

// These small LRU caches share pending work across cards without retaining every
// uploaded data URL or every text edit for the lifetime of the app. Failed loads
// are removed so selecting the same resource again can retry it.
const watermarkCache = new Map<string, Promise<HTMLImageElement>>();
const fontCache = new Map<string, Promise<void>>();

const cachedResource = <T>(
  cache: Map<string, Promise<T>>,
  key: string,
  limit: number,
  load: () => Promise<T>,
): Promise<T> => {
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const pending = Promise.resolve().then(load).catch((error) => {
    if (cache.get(key) === pending) cache.delete(key);
    throw error;
  });
  cache.set(key, pending);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
  return pending;
};

export interface CompositionRenderOptions {
  /** Cap preview bitmap dimensions; omitted for full-resolution export. */
  maxDimension?: number;
  /** A superseded preview returns false without clearing or drawing its canvas. */
  isCurrent?: () => boolean;
}

/**
 * Draw the same composition for live preview and export, without image encoding.
 * Coordinates and font sizes stay in actual output pixels. Only the bitmap and
 * its transform are reduced for previews; warning overlays never enter here.
 */
export const renderCompositionToCanvas = async (
  canvas: HTMLCanvasElement,
  imageElement: HTMLImageElement,
  settings: TagSettings,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
  options: CompositionRenderOptions = {},
): Promise<boolean> => {
  const isCurrent = options.isCurrent ?? (() => true);
  if (!isCurrent()) return false;
  const snapshot = { ...settings };
  const geometry = getImageGeometry(
    imageElement.width, imageElement.height, snapshot, offsetX, offsetY, scale,
  );
  const fontString = `${snapshot.fontWeight} ${snapshot.fontSize}px "Noto Sans SC"`;
  let textToDraw = snapshot.text;
  if (snapshot.usePrefix && textToDraw && !textToDraw.startsWith('* ')) {
    textToDraw = '* ' + textToDraw;
  }

  const fontReady = snapshot.enableTextWatermark && textToDraw && document.fonts?.load
    ? cachedResource(fontCache, `${fontString}\0${textToDraw}`, 32,
      () => document.fonts.load(fontString, textToDraw).then(() => undefined))
      .catch((error) => { console.warn('Font could not be loaded, using fallback', error); })
    : Promise.resolve();
  const watermarkReady = snapshot.enableImageWatermark && snapshot.watermarkImage
    ? cachedResource(watermarkCache, snapshot.watermarkImage, 4,
      () => loadImage(snapshot.watermarkImage!).then(async (image) => {
        if (typeof image.decode === 'function') await image.decode();
        return image;
      }).catch((error) => {
        throw new Error('图片水印加载失败，请重新选择图片', { cause: error });
      }))
    : Promise.resolve(null);

  let watermark: HTMLImageElement | null;
  try {
    [, watermark] = await Promise.all([fontReady, watermarkReady]);
  } catch (error) {
    if (!isCurrent()) return false;
    throw error;
  }
  // No canvas mutation before all asynchronous resources are ready. Everything
  // below is synchronous, so an old render cannot overwrite a newer one.
  if (!isCurrent()) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not found');

  const limit = options.maxDimension;
  const ratio = limit !== undefined && Number.isFinite(limit) && limit > 0
    ? Math.min(1, Math.max(1, Math.floor(limit)) / Math.max(1, geometry.canvasWidth, geometry.canvasHeight))
    : 1;
  canvas.width = geometry.canvasWidth > 0 ? Math.max(1, Math.round(geometry.canvasWidth * ratio)) : 0;
  canvas.height = geometry.canvasHeight > 0 ? Math.max(1, Math.round(geometry.canvasHeight * ratio)) : 0;
  const scaleX = geometry.canvasWidth > 0 ? canvas.width / geometry.canvasWidth : 1;
  const scaleY = geometry.canvasHeight > 0 ? canvas.height / geometry.canvasHeight : 1;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.drawImage(imageElement, geometry.drawX, geometry.drawY, geometry.drawWidth, geometry.drawHeight);

  ctx.font = fontString;
  ctx.fillStyle = snapshot.color;
  ctx.globalAlpha = snapshot.opacity;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  if ('fontKerning' in ctx) ctx.fontKerning = 'normal';

  const shadowOffset = Math.max(1, snapshot.fontSize / 24);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  // Canvas shadows are not scaled by the current transform. Account for the
  // preview bitmap scale explicitly (integer bitmap rounding can differ by axis).
  ctx.shadowBlur = shadowOffset * 2 * Math.min(scaleX, scaleY);
  ctx.shadowOffsetX = shadowOffset * scaleX;
  ctx.shadowOffsetY = shadowOffset * scaleY;
  if (snapshot.enableTextWatermark && textToDraw) {
    ctx.fillText(textToDraw, snapshot.marginX, geometry.canvasHeight - snapshot.marginY);
  }

  if (watermark) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = snapshot.watermarkOpacity;
    const wmWidth = watermark.width * snapshot.watermarkScale;
    const wmHeight = watermark.height * snapshot.watermarkScale;
    let wmX = 0;
    let wmY = 0;
    switch (snapshot.watermarkPosition) {
      case 'center':
        wmX = (geometry.canvasWidth - wmWidth) / 2;
        wmY = (geometry.canvasHeight - wmHeight) / 2;
        break;
      case 'bottom-right':
        wmX = geometry.canvasWidth - wmWidth - snapshot.marginX;
        wmY = geometry.canvasHeight - wmHeight - snapshot.marginY;
        break;
      case 'bottom-left':
        wmX = snapshot.marginX;
        wmY = geometry.canvasHeight - wmHeight - snapshot.marginY;
        break;
      case 'top-right':
        wmX = geometry.canvasWidth - wmWidth - snapshot.marginX;
        wmY = snapshot.marginY;
        break;
      case 'top-left':
        wmX = snapshot.marginX;
        wmY = snapshot.marginY;
        break;
    }
    ctx.drawImage(watermark, wmX, wmY, wmWidth, wmHeight);
  }
  return true;
};

/** Processes and encodes a full-resolution image using the shared composition. */
export const processImageWithWatermark = async (
  imageElement: HTMLImageElement,
  settings: TagSettings,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
  originalFormat = 'image/jpeg',
): Promise<string> => {
  const canvas = document.createElement('canvas');
  await renderCompositionToCanvas(canvas, imageElement, settings, offsetX, offsetY, scale);

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
