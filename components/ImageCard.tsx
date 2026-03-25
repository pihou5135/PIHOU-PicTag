
import React, { useRef, useState, useEffect } from 'react';
import { ImageFile, TagSettings } from '../types';
import { X, CheckCircle, Clock, AlertCircle, Download, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { downloadUrl } from '../services/canvasUtils';

interface ImageCardProps {
  image: ImageFile;
  settings: TagSettings;
  onRemove: (id: string) => void;
  onUpdateOffset: (id: string, x: number, y: number) => void;
  onUpdateScale: (id: string, scale: number) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, settings, onRemove, onUpdateOffset, onUpdateScale }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!settings.enableCrop) return;
    setIsDragging(true);
    // Adjust start position relative to scale
    setStartPos({ 
      x: e.clientX - (image.offsetX * previewScale), 
      y: e.clientY - (image.offsetY * previewScale) 
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    // Calculate new offset in real coordinates
    const newX = (e.clientX - startPos.x) / previewScale;
    const newY = (e.clientY - startPos.y) / previewScale;
    onUpdateOffset(image.id, newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!settings.enableCrop) return;
    
    // Only zoom if Ctrl or Meta key is pressed to prevent accidental zoom while scrolling the page
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.1, Math.min(10, image.scale * factor));
      onUpdateScale(image.id, newScale);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startPos]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!settings.enableCrop) return;
    const step = e.shiftKey ? 10 : 1;
    let newX = image.offsetX;
    let newY = image.offsetY;

    switch (e.key) {
      case 'ArrowLeft': newX -= step; break;
      case 'ArrowRight': newX += step; break;
      case 'ArrowUp': newY -= step; break;
      case 'ArrowDown': newY += step; break;
      case '+': 
      case '=': onUpdateScale(image.id, Math.min(10, image.scale + 0.1)); break;
      case '-': 
      case '_': onUpdateScale(image.id, Math.max(0.1, image.scale - 0.1)); break;
      default: return;
    }

    e.preventDefault();
    onUpdateOffset(image.id, newX, newY);
  };

  // Calculate preview scale to fit the card
  const [previewScale, setPreviewScale] = useState(1);
  
  useEffect(() => {
    if (!containerRef.current || !settings.enableCrop) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const scale = Math.min(width / settings.cropWidth, height / settings.cropHeight);
    setPreviewScale(scale);
  }, [settings.cropWidth, settings.cropHeight, settings.enableCrop]);

  return (
    <div 
      className={`group relative bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md outline-none focus:ring-2 focus:ring-blue-500 ${settings.enableCrop ? 'cursor-move' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Remove Button */}
      <button
        onClick={() => onRemove(image.id)}
        className="absolute top-2 right-2 z-20 p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Crop Indicator Overlay */}
      {settings.enableCrop && (
        <div className="absolute top-2 left-2 z-20 pointer-events-none flex flex-col gap-1">
          <div className="bg-blue-600/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <Move className="w-3 h-3" />
            <span>拖拽移动 / Ctrl+滚轮缩放</span>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <span>缩放: {Math.round(image.scale * 100)}%</span>
          </div>
        </div>
      )}

      {/* Image Preview Container */}
      <div 
        ref={containerRef}
        className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {image.processedUrl ? (
          <img 
            src={image.processedUrl} 
            alt="Processed" 
            className="w-full h-full object-contain animate-in fade-in duration-300"
          />
        ) : settings.enableCrop ? (
          <div 
            className="relative border border-blue-400/30 shadow-inner overflow-hidden flex items-center justify-center bg-white"
            style={{ 
              width: settings.cropWidth >= settings.cropHeight ? '100%' : 'auto',
              height: settings.cropHeight > settings.cropWidth ? '100%' : 'auto',
              aspectRatio: `${settings.cropWidth} / ${settings.cropHeight}`,
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          >
            <img 
              src={image.previewUrl} 
              alt="Original" 
              className="absolute max-w-none pointer-events-none select-none"
              style={{ 
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${image.offsetX * previewScale}px), calc(-50% + ${image.offsetY * previewScale}px)) scale(${previewScale * image.scale})`,
              }}
            />
            {/* Overlay to show it's a preview of the crop */}
            <div className="absolute inset-0 border-2 border-blue-500/20 pointer-events-none" />
          </div>
        ) : (
          <img 
            src={image.previewUrl} 
            alt="Original" 
            className="w-full h-full object-contain opacity-50 grayscale"
          />
        )}
      </div>

      {/* Footer / Meta */}
      <div className="p-3 border-t bg-white relative z-10">
        {settings.enableCrop && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <ZoomOut className="w-3 h-3 text-gray-400" />
            <input 
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={image.scale}
              onChange={(e) => onUpdateScale(image.id, parseFloat(e.target.value))}
              className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <ZoomIn className="w-3 h-3 text-gray-400" />
          </div>
        )}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-gray-400 truncate max-w-[120px]">
            {image.file.name}
          </span>
          <div className="flex items-center">
            {image.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {image.status === 'processing' && <Clock className="w-4 h-4 text-blue-500 animate-pulse" />}
            {image.status === 'pending' && <Clock className="w-4 h-4 text-gray-300" />}
            {image.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">
            {settings.enableCrop ? `${settings.cropWidth} × ${settings.cropHeight}` : `${image.width} × ${image.height}`} px
          </span>
          {image.processedUrl && (
            <button
              onClick={() => downloadUrl(image.processedUrl!, `tagged_${image.file.name}`)}
              className="text-blue-500 hover:text-blue-700 p-1"
              title="单独下载"
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
