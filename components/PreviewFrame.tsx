import React from 'react';

interface PreviewFrameProps {
  content: string; // Can be HTML or SVG
  type: 'html' | 'svg';
}

export const PreviewFrame: React.FC<PreviewFrameProps> = ({ content, type }) => {
  if (!content) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl min-h-[400px]">
        <div className="w-16 h-16 mb-4 bg-slate-200 rounded-full animate-pulse"></div>
        <p>ここにデザインプレビューが表示されます</p>
      </div>
    );
  }

  return (
    <div className="w-full border rounded-xl overflow-hidden shadow-sm bg-white">
      <div className="bg-slate-100 px-4 py-2 border-b flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
        <span className="text-xs text-slate-500 ml-2">
          {type === 'svg' ? 'Vector Preview (Adobe Illustrator Compatible)' : 'Web Preview'}
        </span>
      </div>
      <div className="relative w-full overflow-auto min-h-[500px] flex justify-center bg-[#e5e5e5]">
         {/* Render SVG or HTML directly */}
         <div 
            className="origin-top scale-[0.6] sm:scale-[0.8] lg:scale-100 transition-transform bg-white shadow-lg my-4"
            dangerouslySetInnerHTML={{ __html: content }} 
         />
      </div>
    </div>
  );
};