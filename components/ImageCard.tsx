import React, { useRef, useState, useEffect } from 'react';
import { ImageFile, TagSettings } from '../types';
import { X, CheckCircle, Clock, AlertCircle, Download, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getByteSizeOfDataUrl } from '../services/canvasUtils';
import { getImageGeometry, EDGE_LABELS } from '../services/coverage';
import LivePreview from './LivePreview';

interface ImageCardProps {
  image: ImageFile;
  settings: TagSettings;
  onRemove: (id: string) => void;
  onUpdateOffset: (id: string, x: number, y: number) => void;
  onUpdateScale: (id: string, scale: number) => void;
  onDownload: (id: string) => void;
  disabled?: boolean;
  downloadDisabled?: boolean;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, settings, onRemove, onUpdateOffset, onUpdateScale, onDownload, disabled = false, downloadDisabled = false }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const previewScaleRef = useRef(1);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const geometry = getImageGeometry(image.width, image.height, settings, image.offsetX, image.offsetY, image.scale);
  const { uncoveredEdges } = geometry;
  const canvasWidth = Math.max(1, geometry.canvasWidth);
  const canvasHeight = Math.max(1, geometry.canvasHeight);
  const warningId = `coverage-${image.id}`;

  // Measure the actual export preview, not the surrounding square card. CSS
  // layout changes and browser resizing must not change image-space offsets.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const updateScale = () => {
      previewScaleRef.current = preview.getBoundingClientRect().width / canvasWidth || 1;
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    if (disabled || !settings.enableCrop) {
      dragRef.current = null;
      setIsDragging(false);
    }
  }, [disabled, settings.enableCrop]);

  const getFormattedSize = () => {
    const bytes = image.processedUrl ? getByteSizeOfDataUrl(image.processedUrl) : image.file.size;
    return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settings.enableCrop || disabled || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget.closest('[data-image-card]') as HTMLElement | null)?.focus({ preventScroll: true });
    previewScaleRef.current = e.currentTarget.getBoundingClientRect().width / canvasWidth || 1;
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, offsetX: image.offsetX, offsetY: image.offsetY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || disabled || !settings.enableCrop) return;
    onUpdateOffset(image.id,
      drag.offsetX + (e.clientX - drag.x) / previewScaleRef.current,
      drag.offsetY + (e.clientY - drag.y) / previewScaleRef.current);
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const handleWheel = (event: WheelEvent) => {
      if (!settings.enableCrop || disabled || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      onUpdateScale(image.id, Math.max(0.1, Math.min(10, image.scale * factor)));
    };
    // React's delegated wheel listener can be passive. A local non-passive
    // listener keeps Ctrl+wheel from also zooming the browser page.
    preview.addEventListener('wheel', handleWheel, { passive: false });
    return () => preview.removeEventListener('wheel', handleWheel);
  }, [settings.enableCrop, disabled, image.id, image.scale, onUpdateScale]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Do not turn slider/button keyboard input into a second image movement.
    if (!settings.enableCrop || disabled || e.target !== e.currentTarget) return;
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft': onUpdateOffset(image.id, image.offsetX - step, image.offsetY); break;
      case 'ArrowRight': onUpdateOffset(image.id, image.offsetX + step, image.offsetY); break;
      case 'ArrowUp': onUpdateOffset(image.id, image.offsetX, image.offsetY - step); break;
      case 'ArrowDown': onUpdateOffset(image.id, image.offsetX, image.offsetY + step); break;
      case '+':
      case '=': onUpdateScale(image.id, Math.min(10, image.scale + 0.1)); break;
      case '-':
      case '_': onUpdateScale(image.id, Math.max(0.1, image.scale - 0.1)); break;
      default: return;
    }
    e.preventDefault();
  };

  const gapPercent = (value: number, dimension: number) => `${Math.max(0, Math.min(100, value / dimension * 100))}%`;
  const edgeStyles: Record<string, React.CSSProperties> = {
    top: { top: 0, left: 0, right: 0, height: gapPercent(geometry.drawY, canvasHeight), borderTop: '3px solid #d97706' },
    right: { top: 0, right: 0, bottom: 0, width: gapPercent(canvasWidth - geometry.drawX - geometry.drawWidth, canvasWidth), borderRight: '3px solid #d97706' },
    bottom: { bottom: 0, left: 0, right: 0, height: gapPercent(canvasHeight - geometry.drawY - geometry.drawHeight, canvasHeight), borderBottom: '3px solid #d97706' },
    left: { top: 0, left: 0, bottom: 0, width: gapPercent(geometry.drawX, canvasWidth), borderLeft: '3px solid #d97706' },
  };

  return (
    <div
      data-image-card
      data-image-name={image.file.name}
      role="group"
      aria-label={`图片 ${image.file.name}`}
      aria-describedby={uncoveredEdges.length ? warningId : undefined}
      className="group relative bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md outline-none focus:ring-2 focus:ring-blue-500"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(image.id)}
        aria-label={`移除 ${image.file.name}`}
        className="absolute top-2 right-2 z-20 p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-50 disabled:opacity-30"
      >
        <X className="w-4 h-4" />
      </button>

      {settings.enableCrop && (
        <div className="absolute top-2 left-2 z-20 pointer-events-none flex flex-col gap-1">
          <div className="bg-blue-600/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <Move className="w-3 h-3" />
            <span>拖拽移动 / Ctrl+滚轮缩放</span>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded">
            缩放: {Math.round(image.scale * 100)}%
          </div>
        </div>
      )}

      <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
        <div
          ref={previewRef}
          data-testid="export-preview"
          className={`relative overflow-hidden flex-shrink-0 bg-white ${settings.enableCrop && !disabled ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          style={{
            width: canvasWidth >= canvasHeight ? '100%' : `${canvasWidth / canvasHeight * 100}%`,
            height: canvasHeight >= canvasWidth ? '100%' : `${canvasHeight / canvasWidth * 100}%`,
            touchAction: settings.enableCrop ? 'none' : 'auto',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <LivePreview image={image} settings={settings} />
          {/* UI only: neither these stripes nor the warning text enter Canvas. */}
          {uncoveredEdges.map(edge => (
            <div
              key={edge}
              data-uncovered-edge={edge}
              aria-hidden="true"
              className="absolute pointer-events-none"
              style={{ ...edgeStyles[edge], background: 'repeating-linear-gradient(135deg, rgba(245,158,11,.22) 0 5px, rgba(245,158,11,.06) 5px 10px)' }}
            />
          ))}
          {settings.enableCrop && !uncoveredEdges.length && <div aria-hidden="true" className="absolute inset-0 border border-blue-500/20 pointer-events-none" />}
        </div>
      </div>

      <div className="p-3 border-t bg-white relative z-10">
        <div id={warningId} role="status" aria-live="polite" aria-atomic="true" data-testid="coverage-warning">
          {uncoveredEdges.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>未铺满：{uncoveredEdges.map(edge => EDGE_LABELS[edge]).join('、')}边缘。请调整图片，或在导出时确认留白。</span>
            </p>
          )}
        </div>
        {settings.enableCrop && (
          <>
            <div className="flex items-center gap-2 mb-2 px-1">
              <ZoomOut className="w-3 h-3 text-gray-400" />
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.05"
                value={image.scale}
                disabled={disabled}
                aria-label={`缩放 ${image.file.name}`}
                onChange={(e) => onUpdateScale(image.id, parseFloat(e.target.value))}
                className="flex-1 min-w-0 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-40"
              />
              <ZoomIn className="w-3 h-3 text-gray-400" />
            </div>
            <button
              type="button"
              disabled={disabled || (image.offsetX === 0 && image.offsetY === 0 && image.scale === 1)}
              aria-label={`复位 ${image.file.name}`}
              title="恢复原始缩放和居中位置"
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 disabled:opacity-40 mb-2"
              onClick={() => { onUpdateOffset(image.id, 0, 0); onUpdateScale(image.id, 1); }}
            >
              <RotateCcw className="w-3 h-3" />复位
            </button>
          </>
        )}
        <div className="flex items-center justify-between mb-1 gap-1">
          <span className="text-xs font-mono text-gray-400 truncate" title={image.file.name}>{image.file.name}</span>
          <div className="flex items-center flex-shrink-0">
            {image.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {image.status === 'processing' && <Clock className="w-4 h-4 text-blue-500 animate-pulse" />}
            {image.status === 'pending' && <Clock className="w-4 h-4 text-gray-300" />}
            {image.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-gray-500 truncate">{geometry.canvasWidth} × {geometry.canvasHeight} px</span>
            <span className="text-[9px] font-mono text-gray-450">大小: {getFormattedSize()}</span>
          </div>
          {image.processedUrl && (
            <button
              type="button"
              disabled={disabled || downloadDisabled}
              onClick={() => onDownload(image.id)}
              className="text-blue-500 hover:text-blue-700 p-1 disabled:opacity-40"
              title="单独下载"
              aria-label={`下载 ${image.file.name}`}
            >
              <Download className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
