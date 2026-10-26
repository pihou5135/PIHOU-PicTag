import type { TagSettings } from '../types';

export type CoverageEdge = 'top' | 'right' | 'bottom' | 'left';

export const EDGE_LABELS: Record<CoverageEdge, string> = {
  top: '上',
  right: '右',
  bottom: '下',
  left: '左',
};

type GeometrySettings = Pick<TagSettings,
  'enableCrop' | 'cropWidth' | 'cropHeight' | 'enableResize' |
  'resizeWidth' | 'resizeHeight' | 'maintainAspectRatio'>;

export interface ImageGeometry {
  canvasWidth: number;
  canvasHeight: number;
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  uncoveredEdges: CoverageEdge[];
}

/**
 * Shared by preview, export checks and Canvas drawing. All values are in output
 * pixels, independent of CSS display size or devicePixelRatio. Only the source
 * rectangle is checked; transparent pixels or white borders inside it are not.
 */
export const getImageGeometry = (
  sourceWidth: number,
  sourceHeight: number,
  settings: GeometrySettings,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
): ImageGeometry => {
  let finalWidth = sourceWidth;
  let finalHeight = sourceHeight;

  if (settings.enableCrop) {
    finalWidth = settings.cropWidth;
    finalHeight = settings.cropHeight;
  } else if (settings.enableResize) {
    if (settings.maintainAspectRatio) {
      const ratio = Math.min(settings.resizeWidth / sourceWidth, settings.resizeHeight / sourceHeight);
      finalWidth = sourceWidth * ratio;
      finalHeight = sourceHeight * ratio;
    } else {
      finalWidth = settings.resizeWidth;
      finalHeight = settings.resizeHeight;
    }
  }

  // Match Canvas width/height's unsigned-long conversion, including fractional
  // truncation, before calculating the center of the actual output rectangle.
  const canvasWidth = finalWidth >>> 0;
  const canvasHeight = finalHeight >>> 0;
  const drawWidth = settings.enableCrop ? sourceWidth * scale : canvasWidth;
  const drawHeight = settings.enableCrop ? sourceHeight * scale : canvasHeight;
  const drawX = settings.enableCrop ? (canvasWidth - drawWidth) / 2 + offsetX : 0;
  const drawY = settings.enableCrop ? (canvasHeight - drawHeight) / 2 + offsetY : 0;
  const uncoveredEdges: CoverageEdge[] = [];

  if (settings.enableCrop && canvasWidth > 0 && canvasHeight > 0) {
    // Ignore numerical roundoff only, not a CSS pixel or a whole output pixel.
    const tolerance = Number.EPSILON * 32 * Math.max(
      1, canvasWidth, canvasHeight, drawWidth, drawHeight, Math.abs(drawX), Math.abs(drawY),
    );
    if (drawY > tolerance) uncoveredEdges.push('top');
    if (drawX + drawWidth < canvasWidth - tolerance) uncoveredEdges.push('right');
    if (drawY + drawHeight < canvasHeight - tolerance) uncoveredEdges.push('bottom');
    if (drawX > tolerance) uncoveredEdges.push('left');
  }

  return { canvasWidth, canvasHeight, drawX, drawY, drawWidth, drawHeight, uncoveredEdges };
};
