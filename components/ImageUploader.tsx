import React, { useCallback } from 'react';
import { UploadedImage } from '../types';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ label, images, onImagesChange }) => {

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newImages: UploadedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      
      const promise = new Promise<UploadedImage>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          
          resolve({
            id: crypto.randomUUID(),
            file,
            previewUrl: result,
            base64Data,
            mimeType: file.type
          });
        };
      });

      reader.readAsDataURL(file);
      newImages.push(await promise);
    }

    onImagesChange([...images, ...newImages]);
  }, [images, onImagesChange]);

  const removeImage = (id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-slate-700">{label}</label>
        <span className="text-[10px] font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-500">{images.length} 枚</span>
      </div>

      <div 
        className="border-2 border-dashed border-slate-200 rounded-xl p-6 transition-all hover:border-brand-400 hover:bg-brand-50/50 cursor-pointer text-center group"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById(`fileInput-${label}`)?.click()}
      >
        <input 
          type="file" 
          id={`fileInput-${label}`} 
          className="hidden" 
          multiple 
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)} 
        />
        <div className="mx-auto w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
          <Upload size={18} />
        </div>
        <p className="text-xs text-slate-500 font-medium">画像をドロップして追加</p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
              <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};