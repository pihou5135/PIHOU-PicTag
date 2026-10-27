
import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Download, Trash2, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';
import { TagSettings, ImageFile } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { downloadUrl, loadImage, processImageWithWatermark } from './services/canvasUtils';
import { getExportEntries } from './services/exportUtils';
import { getCoverageIssues } from './services/exportChecks';
import CoverageDialog from './components/CoverageDialog';
import SettingsPanel from './components/SettingsPanel';
import ImageCard from './components/ImageCard';

type ExportRequest = { kind: 'single' | 'zip'; images: ImageFile[] };

const App: React.FC = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [settings, setSettings] = useState<TagSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReadingWatermark, setIsReadingWatermark] = useState(false);
  const readingWatermarkRef = useRef(false);
  const handleWatermarkReadState = useCallback((reading: boolean) => {
    readingWatermarkRef.current = reading;
    setIsReadingWatermark(reading);
  }, []);
  const [pendingExport, setPendingExport] = useState<ExportRequest | null>(null);
  const pendingExportRef = useRef<ExportRequest | null>(null);
  const busyRef = useRef(false);
  const isBusy = isProcessing || isExporting;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (busyRef.current) return;
    const files = e.target.files;
    if (!files) return;

    const newImages: ImageFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const previewUrl = URL.createObjectURL(file);
      
      try {
        const img = await loadImage(previewUrl);
        newImages.push({
          id: uuidv4(),
          file,
          previewUrl,
          processedUrl: null,
          status: 'pending',
          width: img.width,
          height: img.height,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0,
        });
      } catch (err) {
        console.error("Error loading image:", file.name, err);
      }
    }

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const processAll = async () => {
    if (images.length === 0 || busyRef.current || readingWatermarkRef.current) return;
    busyRef.current = true;
    setIsProcessing(true);

    const updatedImages = [...images];
    
    for (let i = 0; i < updatedImages.length; i++) {
      const imgItem = updatedImages[i];
      try {
        updatedImages[i] = { ...imgItem, status: 'processing' };
        setImages([...updatedImages]);

        const originalImg = await loadImage(imgItem.previewUrl);
        const processedDataUrl = await processImageWithWatermark(
          originalImg, 
          settings, 
          imgItem.offsetX, 
          imgItem.offsetY,
          imgItem.scale,
          imgItem.file.type
        );
        
        updatedImages[i] = {
          ...updatedImages[i],
          processedUrl: processedDataUrl,
          status: 'done'
        };
      } catch (err) {
        console.error("Failed to process image:", imgItem.file.name, err);
        updatedImages[i] = { ...imgItem, status: 'error' };
      }
      setImages([...updatedImages]);
    }

    busyRef.current = false;
    setIsProcessing(false);
  };

  // Editing invalidates the result so export checks and exported pixels share one state.
  const updateSettings: React.Dispatch<React.SetStateAction<TagSettings>> = (next) => {
    if (busyRef.current) return;
    setSettings(next);
    setImages(prev => prev.map(img => ({ ...img, status: 'pending', processedUrl: null })));
  };

  const executeExport = async (request: ExportRequest) => {
    if (busyRef.current || readingWatermarkRef.current) return;
    busyRef.current = true;
    setIsExporting(true);
    try {
      const entries = getExportEntries(request.images);
      if (request.kind === 'single') {
        if (entries[0]) downloadUrl(entries[0].url, entries[0].filename);
      } else {
        const zip = new JSZip();
        entries.forEach(entry => zip.file(entry.filename, entry.base64, { base64: true }));
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        try {
          downloadUrl(url, `PicTag_Export_${Date.now()}.zip`);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Failed to export images:', error);
      alert('导出失败，请重试');
    } finally {
      busyRef.current = false;
      setIsExporting(false);
    }
  };

  const requestExport = (kind: ExportRequest['kind'], id?: string) => {
    if (busyRef.current || readingWatermarkRef.current || pendingExportRef.current) return;
    const ready = images.filter(img => img.status === 'done' && img.processedUrl && (!id || img.id === id));
    if (!ready.length) {
      alert("没有已处理完成的图片可下载，请先点击'应用到所有图片'");
      return;
    }
    const request = { kind, images: ready };
    if (getCoverageIssues(ready, settings).length) {
      pendingExportRef.current = request;
      setPendingExport(request);
    } else {
      void executeExport(request);
    }
  };

  const cancelExport = () => {
    pendingExportRef.current = null;
    setPendingExport(null);
  };

  const confirmExport = () => {
    // Consume before starting async ZIP work; repeated clicks cannot export twice.
    const request = pendingExportRef.current;
    if (!request) return;
    cancelExport();
    void executeExport(request);
  };

  const removeImage = (id: string) => {
    if (busyRef.current) return;
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const updateImageOffset = (id: string, offsetX: number, offsetY: number) => {
    if (busyRef.current) return;
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, offsetX, offsetY, status: 'pending', processedUrl: null } : img
    ));
  };

  const updateImageScale = (id: string, scale: number) => {
    if (busyRef.current) return;
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, scale, status: 'pending', processedUrl: null } : img
    ));
  };

  const clearAll = () => {
    if (busyRef.current) return;
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Settings */}
      <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 border-b md:border-b-0">
        <fieldset disabled={isBusy} className="h-full min-w-0">
          <SettingsPanel
            settings={settings}
            setSettings={updateSettings}
            onApplyAll={processAll}
            isProcessing={isProcessing}
            onWatermarkReadStateChange={handleWatermarkReadState}
          />
        </fieldset>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">PicTag Batch</h1>
              <p className="text-xs text-gray-500 mt-1">批量加标签工具</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {images.length > 0 && (
              <button
                onClick={clearAll}
                disabled={isBusy}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" /> 
                <span className="hidden sm:inline">清空</span>
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-lg shadow-sm transition-all"
            >
              <Upload className="w-4 h-4" /> 
              <span>上传图片</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isBusy}
            />
            {images.some(img => img.status === 'done') && (
              <button
                onClick={() => requestExport('zip')}
                disabled={isBusy || isReadingWatermark}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg shadow-md transition-all animate-in fade-in zoom-in"
              >
                <Download className="w-4 h-4" /> 
                <span>{isExporting ? '正在导出…' : '批量导出 ZIP'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Image Grid Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {images.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="h-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all group"
            >
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 group-hover:text-blue-500" />
              </div>
              <p className="text-lg font-medium group-hover:text-slate-600">点击或拖拽上传图片</p>
              <p className="text-sm mt-2">支持多文件批量上传，保持原图尺寸不变</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {images.map(img => (
                <ImageCard 
                  key={img.id} 
                  image={img} 
                  settings={settings}
                  onRemove={removeImage} 
                  onUpdateOffset={updateImageOffset}
                  onUpdateScale={updateImageScale}
                  onDownload={id => requestExport('single', id)}
                  disabled={isBusy}
                  downloadDisabled={isReadingWatermark}
                />
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar (Visible during processing) */}
        {isProcessing && (
          <div className="bg-white border-t p-4 px-8 shadow-inner">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">处理进度</span>
              <span>
                {images.filter(img => img.status === 'done').length} / {images.length}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ 
                  width: `${(images.filter(img => img.status === 'done').length / images.length) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </main>
      {pendingExport && (
        <CoverageDialog
          issues={getCoverageIssues(pendingExport.images, settings)}
          onCancel={cancelExport}
          onConfirm={confirmExport}
        />
      )}
    </div>
  );
};

export default App;
