
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { UploadedImage, AppStatus, SuccessStrategy, GenerationHistory } from './types';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { 
  Sparkles, 
  RotateCcw, 
  Download, 
  AlertCircle,
  TrendingUp,
  Target,
  ChevronRight,
  ChevronLeft,
  History,
  Layout,
  Settings2,
  Maximize2,
  X,
  CheckCircle2,
  Zap,
  MousePointer2,
  Palette,
  Type as TypeIcon
} from 'lucide-react';

/**
 * --- 再現性を極限まで高めるための統合ロジック ---
 */

const getClosestAspectRatio = (width: number, height: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  const ratio = width / height;
  const supported: { name: "1:1" | "3:4" | "4:3" | "9:16" | "16:9"; value: number }[] = [
    { name: '1:1', value: 1.0 },
    { name: '3:4', value: 0.75 },
    { name: '4:3', value: 1.333 },
    { name: '9:16', value: 0.5625 },
    { name: '16:9', value: 1.777 },
  ];
  return supported.reduce((prev, curr) => 
    Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
  ).name;
};

// 1. 参考画像の「売れるDNA」をピクセル単位で分析
async function analyzeSuccessDNA(referenceImages: UploadedImage[]): Promise<SuccessStrategy> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  const imageParts = referenceImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const prompt = `あなたは世界最高峰のデザイン分析官です。添付された参考画像（ファーストビュー）を分析し、
以下の要素を「再現用データ」としてJSONで出力してください。

1. target: このデザインがターゲットとしている人物像
2. valueProp: 訴求されている最大のメリット
3. visualHierarchy: レイアウト構成（要素の配置、Z型/F型の視線誘導、余白の取り方）
4. colorStrategy: メイン・アクセントカラーの16進数コードと比率
5. copySuggestion: 参考画像のトーンを再現したキャッチコピー案

必ず純粋なJSONのみを返してください。`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: { 
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 16000 } 
    }
  });

  try {
    return JSON.parse(response.text || "{}") as SuccessStrategy;
  } catch (e) {
    throw new Error("DNA分析データの解析に失敗しました。");
  }
}

// 2. 分析結果と自社素材を組み合わせて最終画像を生成
async function generateFinalFV(
  strategy: SuccessStrategy,
  assetImages: UploadedImage[],
  userRequest: string,
  dimensions: { width: number; height: number },
  previousImage?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-image-preview';
  const assetParts = assetImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));
  const mappedRatio = getClosestAspectRatio(dimensions.width, dimensions.height);

  let prompt = "";
  const contentParts: any[] = [...assetParts];

  if (previousImage) {
    contentParts.push({ inlineData: { mimeType: 'image/png', data: previousImage } });
    prompt = `【修正依頼】前回の画像をベースに、以下の指示に従って調整してください：${userRequest}`;
  } else {
    prompt = `【究極の再現】
参考画像のDNA（レイアウト、配色、空気感）を95%の精度で再現しつつ、提供された商品素材を完璧に馴染ませたファーストビューを生成してください。

■再現DNA
・構成: ${strategy.visualHierarchy}
・配色: ${strategy.colorStrategy}
・コピー: ${strategy.copySuggestion}
・ユーザー要望: ${userRequest}

アスペクト比は ${mappedRatio} で、広告写真のような最高品質のライティングと質感で出力してください。`;
  }

  contentParts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contentParts },
    config: { 
      imageConfig: { 
        aspectRatio: mappedRatio,
        imageSize: "1K" 
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("画像の生成に失敗しました。");
}

/**
 * --- メイン UI コンポーネント ---
 */

const SIZES = [
  { id: 'std', label: 'PC (1200x900)', w: 1200, h: 900 },
  { id: 'sq', label: 'SNS (1080x1080)', w: 1080, h: 1080 },
  { id: 'pt', label: 'Mobile (1080x1920)', w: 1080, h: 1920 },
];

const App: React.FC = () => {
  const [hasSelectedKey, setHasSelectedKey] = useState(false);
  const [refImages, setRefImages] = useState<UploadedImage[]>([]);
  const [assetImages, setAssetImages] = useState<UploadedImage[]>([]);
  const [userRequest, setUserRequest] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('std');
  const [dimensions, setDimensions] = useState({ width: 1200, height: 900 });
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [strategy, setStrategy] = useState<SuccessStrategy | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        setHasSelectedKey(await window.aistudio.hasSelectedApiKey());
      } else {
        setHasSelectedKey(true);
      }
    };
    checkKey();
  }, []);

  const handleAnalyze = async () => {
    if (refImages.length === 0) { setError('参考画像をアップロードしてください。'); return; }
    setError(''); setStatus(AppStatus.ANALYZING);
    try {
      const s = await analyzeSuccessDNA(refImages);
      setStrategy(s);
      setStatus(AppStatus.REVIEWING_STRATEGY);
    } catch (e: any) { 
      setStatus(AppStatus.ERROR); 
      setError('分析エラーが発生しました。'); 
    }
  };

  const handleGenerateInitial = async () => {
    if (!strategy || assetImages.length === 0) return;
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, dimensions);
      const entry = { imageUrl: b64, dimensions: { ...dimensions }, strategy: { ...strategy } };
      const newHistory = [...history, entry];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setResultImage(b64);
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) { setStatus(AppStatus.ERROR); setError('生成エラーが発生しました。'); }
  };

  const handleAdjust = async () => {
    if (!strategy || currentIndex === -1) return;
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, adjustment, dimensions, history[currentIndex].imageUrl);
      const entry = { imageUrl: b64, dimensions: { ...dimensions }, strategy: { ...strategy } };
      const newHistory = [...history, entry];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setResultImage(b64);
      setStatus(AppStatus.SUCCESS);
      setAdjustment('');
    } catch (e: any) { setStatus(AppStatus.ERROR); setError('修正エラーが発生しました。'); }
  };

  if (!hasSelectedKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
        <Button onClick={async () => { await window.aistudio?.openSelectKey(); setHasSelectedKey(true); }} className="px-12 py-6 rounded-2xl text-xl">認証を開始する</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 flex flex-col overflow-hidden">
      <header className="bg-slate-950 border-b border-slate-800 h-16 px-8 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white shadow-lg"><TrendingUp size={20} /></div>
          <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">PIXEL<span className="text-brand-500">PERFECT</span> FV</h1>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><RotateCcw size={18} /></button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* サイドバー */}
        <aside className="w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col p-8 space-y-10 overflow-y-auto custom-scrollbar shadow-2xl shrink-0">
          <ImageUploader label="STEP 1: お手本画像（売れているFV）" images={refImages} onImagesChange={setRefImages} />
          <ImageUploader label="STEP 2: あなたの商品素材" images={assetImages} onImagesChange={setAssetImages} />
          
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">STEP 3: サイズ選択</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map(s => (
                <button key={s.id} onClick={() => { setSelectedSizeId(s.id); setDimensions({ width: s.w, height: s.h }); }} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${selectedSizeId === s.id ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{s.label}</button>
              ))}
            </div>
          </div>

          <Button onClick={strategy ? handleGenerateInitial : handleAnalyze} isLoading={status === AppStatus.ANALYZING || status === AppStatus.GENERATING} className="w-full h-16 rounded-2xl text-lg shadow-2xl">
            {strategy ? '最終画像を生成' : 'DNA分析を開始'} <Sparkles className="ml-2" />
          </Button>
        </aside>

        {/* メインビュー */}
        <main className="flex-1 flex flex-col bg-[#010413] relative items-center justify-center p-10 overflow-hidden">
          {status === AppStatus.ANALYZING || status === AppStatus.GENERATING ? (
            <div className="text-center space-y-8">
              <div className="w-20 h-20 border-[6px] border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto shadow-2xl shadow-brand-500/10"></div>
              <div className="space-y-2">
                <p className="text-2xl font-black italic tracking-widest text-brand-500 uppercase">{status === AppStatus.ANALYZING ? "Decoding DNA..." : "Rendering Pixels..."}</p>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.5em]">High Precision Processing</p>
              </div>
            </div>
          ) : resultImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
              <div className="relative group max-h-[75%] rounded-3xl overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] border border-white/5 bg-black">
                <img src={`data:image/png;base64,${resultImage}`} className="max-h-full object-contain" alt="Generated FV" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-6 backdrop-blur-sm">
                  <button onClick={() => { const a = document.createElement('a'); a.href = `data:image/png;base64,${resultImage}`; a.download = 'fv-generated.png'; a.click(); }} className="bg-brand-600 p-6 rounded-2xl hover:scale-110 transition-transform text-white shadow-2xl"><Download size={32} /></button>
                </div>
              </div>
              <div className="mt-10 w-full max-w-3xl bg-slate-900/50 p-4 rounded-3xl border border-slate-800 flex space-x-3 backdrop-blur-xl">
                <input type="text" className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 text-xs font-bold outline-none focus:ring-2 ring-brand-500/50" value={adjustment} onChange={e => setAdjustment(e.target.value)} placeholder="さらに修正が必要ですか？（例：テキストを左へ、背景を明るく...）" onKeyDown={e => e.key === 'Enter' && handleAdjust()} />
                <Button onClick={handleAdjust} className="px-10 h-14 rounded-2xl">修正</Button>
              </div>
            </div>
          ) : strategy ? (
            <div className="max-w-3xl w-full space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <div className="text-center space-y-4">
                <div className="inline-block px-4 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-[10px] font-black uppercase tracking-[0.3em]">Analysis Complete</div>
                <h2 className="text-5xl font-black italic tracking-tighter">DESIGN BLUEPRINT</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
                  <p className="text-brand-500 font-black text-[10px] uppercase tracking-widest">Target DNA</p>
                  <p className="text-sm font-bold leading-relaxed text-slate-300">{strategy.target}</p>
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
                  <p className="text-brand-500 font-black text-[10px] uppercase tracking-widest">Layout Structure</p>
                  <p className="text-sm font-bold leading-relaxed text-slate-300">{strategy.visualHierarchy}</p>
                </div>
                <div className="bg-brand-600 p-8 rounded-[2.5rem] col-span-2 text-white shadow-2xl shadow-brand-500/20">
                  <p className="text-white/60 font-black text-[10px] uppercase tracking-widest mb-2">Winning Catchcopy</p>
                  <p className="text-2xl font-black italic leading-tight">「{strategy.copySuggestion}」</p>
                </div>
              </div>
              <div className="flex justify-center">
                <Button onClick={handleGenerateInitial} className="px-16 h-20 text-2xl rounded-3xl shadow-2xl hover:scale-105 transition-transform">このDNAで画像を生成する</Button>
              </div>
            </div>
          ) : (
            <div className="text-center opacity-20 pointer-events-none select-none">
              <Layout size={120} className="mx-auto mb-6 text-slate-500" />
              <p className="text-6xl font-black italic tracking-tighter text-slate-500 uppercase">Input Required</p>
            </div>
          )}
        </main>
      </div>
      {error && <div className="fixed bottom-8 right-8 bg-red-500/20 border border-red-500/50 backdrop-blur-xl text-red-400 px-6 py-4 rounded-2xl font-black text-xs animate-in slide-in-from-right-5"><AlertCircle className="mr-2 inline" size={16} /> {error}</div>}
    </div>
  );
};

export default App;
