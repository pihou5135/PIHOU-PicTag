
import React from 'react';
import { TagSettings } from '../types';
import { FONT_WEIGHTS } from '../constants';
import { Type, Move, Palette, TextCursorInput, Save, RefreshCw, Info, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';

interface SettingsPanelProps {
  settings: TagSettings;
  setSettings: (settings: TagSettings) => void;
  onApplyAll: () => void;
  isProcessing: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  setSettings, 
  onApplyAll,
  isProcessing 
}) => {
  const handleChange = (key: keyof TagSettings, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSavePreset = () => {
    localStorage.setItem('pictag_preset', JSON.stringify(settings));
    alert('预设已保存到本地！');
  };

  const handleLoadPreset = () => {
    const saved = localStorage.getItem('pictag_preset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...settings, ...parsed });
      } catch (e) {
        console.error("Failed to parse preset", e);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleChange('watermarkImage', event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeWatermarkImage = () => {
    handleChange('watermarkImage', null);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white border-r h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <TextCursorInput className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">标签设置</h2>
      </div>

      <div className="space-y-4">
        {/* Text Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">标签文本</label>
          <textarea
            value={settings.text}
            onChange={(e) => handleChange('text', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            rows={2}
            placeholder="输入水印文字..."
          />
        </div>

        {/* Font Style */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
              <Type className="w-4 h-4" /> 字号 (px)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={settings.fontSize}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
              <Palette className="w-4 h-4" /> 颜色
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-10 h-10 p-0 border rounded overflow-hidden cursor-pointer"
              />
              <input
                type="text"
                value={settings.color.toUpperCase()}
                onChange={(e) => handleChange('color', e.target.value)}
                className="flex-1 w-full px-2 py-2 border rounded-lg text-xs uppercase"
              />
            </div>
          </div>
        </div>

        {/* Font Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">字体粗细</label>
          <select
            value={settings.fontWeight}
            onChange={(e) => handleChange('fontWeight', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {FONT_WEIGHTS.map((fw) => (
              <option key={fw.value} value={fw.value}>
                {fw.label}
              </option>
            ))}
          </select>
        </div>

        {/* Image Watermark */}
        <div className="pt-4 border-t border-gray-100">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-3">
            <ImageIcon className="w-4 h-4" /> 图片水印
          </label>
          
          {!settings.watermarkImage ? (
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <span className="text-sm text-gray-500">点击上传水印图片</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative border rounded-lg p-2 bg-gray-50 flex items-center justify-between">
                <img src={settings.watermarkImage} alt="Watermark" className="h-10 object-contain max-w-[150px]" />
                <button
                  onClick={removeWatermarkImage}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="移除水印图片"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">缩放比例 ({settings.watermarkScale}x)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={settings.watermarkScale}
                    onChange={(e) => handleChange('watermarkScale', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">不透明度 ({settings.watermarkOpacity})</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.watermarkOpacity}
                    onChange={(e) => handleChange('watermarkOpacity', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">水印位置</label>
                <select
                  value={settings.watermarkPosition}
                  onChange={(e) => handleChange('watermarkPosition', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="center">居中</option>
                  <option value="bottom-right">右下角</option>
                  <option value="bottom-left">左下角</option>
                  <option value="top-right">右上角</option>
                  <option value="top-left">左上角</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Margins */}
        <div className="space-y-3">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
            <Move className="w-4 h-4" /> 边距 (像素)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 block mb-1">左边距 (X)</span>
              <input
                type="number"
                value={settings.marginX}
                onChange={(e) => handleChange('marginX', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">底边距 (Y)</span>
              <input
                type="number"
                value={settings.marginY}
                onChange={(e) => handleChange('marginY', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Crop Settings */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
              <Move className="w-4 h-4" /> 统一裁切尺寸
            </label>
            <input
              type="checkbox"
              checked={settings.enableCrop}
              onChange={(e) => handleChange('enableCrop', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </div>
          
          {settings.enableCrop && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <span className="text-xs text-gray-500 block mb-1">宽度 (W)</span>
                <input
                  type="number"
                  value={settings.cropWidth}
                  onChange={(e) => handleChange('cropWidth', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">高度 (H)</span>
                <input
                  type="number"
                  value={settings.cropHeight}
                  onChange={(e) => handleChange('cropHeight', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          {settings.enableCrop && (
            <p className="text-[10px] text-gray-400 mt-2">
              开启后，可在图片卡片上拖拽或使用方向键调整位置。
            </p>
          )}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg flex gap-2 border border-blue-100">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 leading-relaxed">
            <b>提示：</b>如果导出后文字看起来太小或模糊，请根据图片分辨率调大<b>字号</b>。系统现已采用 100% 无损画质导出。
          </p>
        </div>
      </div>

      <div className="mt-auto pt-6 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handleSavePreset}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" /> 保存预设
          </button>
          <button
            onClick={handleLoadPreset}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> 加载预设
          </button>
        </div>
        
        <button
          onClick={onApplyAll}
          disabled={isProcessing}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
            isProcessing 
            ? 'bg-blue-300 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              处理中...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              应用到所有图片
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
