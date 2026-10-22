/** Name exports from the actual canvas output, including browser PNG fallbacks. */
export const getExportFilename = (originalName: string, dataUrl: string): string => {
  const mimeType = dataUrl.slice(5).split(/[;,]/, 1)[0].toLowerCase();
  const extension = mimeType === 'image/jpeg' ? 'jpg'
    : mimeType === 'image/webp' ? 'webp' : 'png';
  const lastDotIndex = originalName.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName;
  return `${baseName}.${extension}`;
};

/** Reserve names per ZIP; compare case-insensitively for common extraction targets. */
export const getUniqueExportFilename = (filename: string, usedNames: Set<string>): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.slice(lastDotIndex) : '';
  let candidate = filename;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} (${suffix++})${extension}`;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
};
