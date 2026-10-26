import type { ImageFile, TagSettings } from '../types.ts';
import { EDGE_LABELS, getImageGeometry } from './coverage.ts';

/** Check the same current geometry used by Canvas; no inspection of source alpha/color. */
export const getCoverageIssues = (images: ReadonlyArray<ImageFile>, settings: TagSettings) =>
  images.filter(image => image.status === 'done' && image.processedUrl).flatMap(image => {
    const geometry = getImageGeometry(image.width, image.height, settings,
      image.offsetX, image.offsetY, image.scale);
    return geometry.uncoveredEdges.length ? [{
      id: image.id,
      name: image.file.name,
      edges: geometry.uncoveredEdges.map(edge => EDGE_LABELS[edge]),
    }] : [];
  });
