
import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Download, Trash2, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';
import { TagSettings, ImageFile } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { loadImage, processImageWithWatermark } from './services/canvasUtils';
import SettingsPanel from './components/SettingsPanel';
import ImageCard from './components/ImageCard';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [settings, setSettings] = useState<TagSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (images.length === 0) return;
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
          imgItem.scale
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

    setIsProcessing(false);
  };

  const handleDownloadAll = async () => {
    const doneImages = images.filter(img => img.status === 'done' && img.processedUrl);
    if (doneImages.length === 0) {
      alert("没有已处理完成的图片可下载，请先点击'应用到所有图片'");
      return;
    }

    const zip = new JSZip();
    doneImages.forEach((img, idx) => {
      const base64Data = img.processedUrl!.split(',')[1];
      zip.file(`tagged_${img.file.name}`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PicTag_Export_${new Date().getTime()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const updateImageOffset = (id: string, offsetX: number, offsetY: number) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, offsetX, offsetY, status: 'pending', processedUrl: null } : img
    ));
  };

  const updateImageScale = (id: string, scale: number) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, scale, status: 'pending', processedUrl: null } : img
    ));
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Settings */}
      <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 border-b md:border-b-0">
        <SettingsPanel 
          settings={settings} 
          setSettings={setSettings} 
          onApplyAll={processAll}
          isProcessing={isProcessing}
        />
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
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" /> 
                <span className="hidden sm:inline">清空</span>
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
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
            />
            {images.some(img => img.status === 'done') && (
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg shadow-md transition-all animate-in fade-in zoom-in"
              >
                <Download className="w-4 h-4" /> 
                <span>批量导出 ZIP</span>
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
    </div>
  );
};

export default App;
