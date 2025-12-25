
export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string; // Raw base64 without prefix for API
  mimeType: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',   // Step 1: デザインDNAの分析中
  REVIEW = 'REVIEW',         // Step 2: 設計図の確認・微調整
  GENERATING = 'GENERATING', // Step 3: 高精度描画中
  SUCCESS = 'SUCCESS',       // 完了
  ERROR = 'ERROR'
}

export type ModelType = 'gemini-3-pro-preview' | 'gemini-3-pro-image-preview';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}
