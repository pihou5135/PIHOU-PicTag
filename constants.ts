
import { TagSettings } from './types';

export const FONT_WEIGHTS = [
  { label: '细体 (100)', value: '100' },
  { label: '常规 (400)', value: '400' },
  { label: '中等 (500)', value: '500' },
  { label: '粗体 (700)', value: '700' },
  { label: '特粗 (900)', value: '900' },
];

export const DEFAULT_SETTINGS: TagSettings = {
  text: '* 运河私董会交流现场',
  fontSize: 48,
  color: '#ffffff',
  fontWeight: '700',
  opacity: 1,
  marginX: 60,
  marginY: 60,
  usePrefix: false,
  watermarkImage: null,
  watermarkOpacity: 1,
  watermarkScale: 1,
  watermarkPosition: 'bottom-right',
  // Default crop settings
  enableCrop: false,
  cropWidth: 1080,
  cropHeight: 1080
};
