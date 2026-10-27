import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ImageFile, TagSettings } from '../types';
import { loadImage, renderCompositionToCanvas } from '../services/canvasUtils';

interface LivePreviewProps {
  image: ImageFile;
  settings: TagSettings;
}

/** A bounded, visible-only drawing surface. Encoding remains an explicit export step. */
const LivePreview: React.FC<LivePreviewProps> = ({ image, settings }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<{ url: string; promise: Promise<HTMLImageElement> } | null>(null);
  const [visible, setVisible] = useState(false);
  const [maxDimension, setMaxDimension] = useState(512);
  const [state, setState] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const outputFormat = settings.enableFormatConversion ? settings.targetFormat : image.file.type;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      setMaxDimension(Math.min(1024, Math.max(64, Math.ceil(Math.max(rect.width, rect.height) * density))));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '160px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Layout cleanup invalidates a request before a newer committed state can paint.
  useLayoutEffect(() => {
    let current = true;
    if (!visible) { setState('waiting'); return () => { current = false; }; }
    setState('loading');
    setMessage('');
    const frame = requestAnimationFrame(() => {
      if (!current) return;
      if (!sourceRef.current || sourceRef.current.url !== image.previewUrl) {
        sourceRef.current = { url: image.previewUrl, promise: loadImage(image.previewUrl) };
      }
      const source = sourceRef.current;
      source.promise.then(async original => {
        if (!current || !canvasRef.current) return;
        const drawn = await renderCompositionToCanvas(canvasRef.current, original, settings,
          image.offsetX, image.offsetY, image.scale, { maxDimension, isCurrent: () => current });
        if (drawn && current) { setState('ready'); setRevision(value => value + 1); }
      }).catch(error => {
        if (!current) return;
        // A failed source can be retried on the next edit; never display a stale watermark as current.
        if (sourceRef.current === source) sourceRef.current = null;
        setState('error');
        setMessage(error instanceof Error ? error.message : '预览加载失败，请重新选择图片');
      });
    });
    return () => { current = false; cancelAnimationFrame(frame); };
  }, [visible, maxDimension, image.previewUrl, image.width, image.height, image.offsetX, image.offsetY, image.scale, settings]);

  return (
    <div ref={hostRef} className="absolute inset-0" data-preview-state={state} aria-busy={state === 'loading'}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${image.file.name} 的实时水印预览`}
        data-testid="live-preview"
        data-preview-revision={revision}
        style={{ display: 'block', width: '100%', height: '100%', visibility: state === 'error' ? 'hidden' : 'visible', backgroundColor: outputFormat === 'image/jpeg' ? '#000' : 'transparent' }}
        className="pointer-events-none select-none"
      />
      {(state === 'loading' || state === 'error') && (
        <p role="status" className={`absolute bottom-1 left-1 right-1 rounded px-1.5 py-1 text-[10px] leading-tight pointer-events-none ${state === 'error' ? 'bg-red-50 text-red-700' : 'bg-white/85 text-slate-500'}`}>
          {state === 'error' ? message : '正在更新预览…'}
        </p>
      )}
    </div>
  );
};

export default LivePreview;
