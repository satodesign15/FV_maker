
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
  Zap
} from 'lucide-react';

// --- アシスタント関数 (旧 geminiService.ts) ---

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

async function analyzeSuccessDNA(referenceImages: UploadedImage[]): Promise<SuccessStrategy> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  const imageParts = referenceImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));
  const prompt = `あなたは伝説的なWEBマーケター兼クリエイティブディレクターです。
添付された「売れているFV（参考画像）」を分析し、その成功の要因（DNA）を抽出してください。
表面的なデザインだけでなく、裏側の「心理的フック」や「情報設計」を言語化してください。

JSON形式で出力してください：
{
  "target": "このFVが狙っている具体的なターゲット層とその悩み",
  "valueProp": "一瞬で心を掴むための『最大の売り』の伝え方",
  "visualHierarchy": "視線誘導の設計意図（何から順に見せているか、配置の黄金律）",
  "colorStrategy": "色の組み合わせがユーザーに与える心理的影響と信頼構築の狙い",
  "copySuggestion": "この成功構造を維持しつつ、新しい商品に適用する場合の最強のキャッチコピー案"
}`;
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 16000 } }
  });
  try {
    return JSON.parse(response.text || "{}") as SuccessStrategy;
  } catch (e) {
    throw new Error("成功DNAの分析に失敗しました。AIの回答を解析できません。");
  }
}

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
  let basePrompt = "";
  const contentParts: any[] = [...assetParts];
  if (previousImage) {
    contentParts.push({ inlineData: { mimeType: 'image/png', data: previousImage } });
    basePrompt = `【画像改善指示】前回の生成結果を元に修正してください。指示: ${userRequest} 比率: ${mappedRatio}`;
  } else {
    basePrompt = `【新規生成指令】戦略に基づき、提供された素材を使用して画像を生成してください。
再現性ターゲット: 参考画像の構図・雰囲気・フォント配置を95%以上維持。
ターゲット: ${strategy.target}
配置コピー: 「${strategy.copySuggestion}」
追加要望: ${userRequest}
アスペクト比: ${mappedRatio}`;
  }
  contentParts.push({ text: basePrompt });
  const response = await ai.models.generateContent({
    model,
    contents: { parts: contentParts },
    config: { imageConfig: { aspectRatio: mappedRatio } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("画像の生成に失敗しました。");
}

// --- App コンポーネント ---

const SIZES = [
  { id: 'std', label: '標準 (1200x900)', w: 1200, h: 900 },
  { id: 'sq', label: '正方形 (1080x1080)', w: 1080, h: 1080 },
  { id: 'pt', label: '縦型 (1080x1920)', w: 1080, h: 1920 },
  { id: 'wd', label: 'ワイド (1920x1080)', w: 1920, h: 1080 },
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
  const [isMaximized, setIsMaximized] = useState(false);

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
    if (refImages.length === 0) { setError('参考画像を添付してください。'); return; }
    setError(''); setStatus(AppStatus.ANALYZING);
    try {
      const s = await analyzeSuccessDNA(refImages);
      setStrategy(s); setStatus(AppStatus.REVIEWING_STRATEGY);
    } catch (e: any) { setStatus(AppStatus.ERROR); setError(e.message); }
  };

  const handleGenerateInitial = async () => {
    if (!strategy || assetImages.length === 0) { setError('素材をアップロードしてください。'); return; }
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, dimensions);
      const entry = { imageUrl: b64, dimensions: { ...dimensions }, strategy: { ...strategy } };
      const newHistory = [...history.slice(0, currentIndex + 1), entry];
      setHistory(newHistory); setCurrentIndex(newHistory.length - 1);
      setResultImage(b64); setStatus(AppStatus.SUCCESS);
    } catch (e: any) { setStatus(AppStatus.ERROR); setError(e.message); }
  };

  const handleAdjust = async () => {
    if (!strategy || currentIndex === -1) return;
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, adjustment || "微調整", dimensions, history[currentIndex].imageUrl);
      const entry = { imageUrl: b64, dimensions: { ...dimensions }, strategy: { ...strategy } };
      const newHistory = [...history.slice(0, currentIndex + 1), entry];
      setHistory(newHistory); setCurrentIndex(newHistory.length - 1);
      setResultImage(b64); setStatus(AppStatus.SUCCESS); setAdjustment('');
    } catch (e: any) { setStatus(AppStatus.ERROR); setError(e.message); }
  };

  if (!hasSelectedKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/10">
          <div className="w-20 h-20 bg-brand-600 rounded-3xl mx-auto flex items-center justify-center"><Zap className="text-white" size={40} /></div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Strategic Analysis Locked</h2>
          <p className="text-slate-400 text-xs px-4">分析の実行には有料プランのAPIキーが必要です。</p>
          <Button onClick={async () => { await window.aistudio?.openSelectKey(); setHasSelectedKey(true); }} className="w-full py-5 rounded-2xl text-lg">認証を開始</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 font-sans flex flex-col overflow-hidden">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 h-16 px-8 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white"><TrendingUp size={20} /></div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">PixelPerfect <span className="text-brand-500">FV</span></h1>
        </div>
        <button onClick={() => { setStatus(AppStatus.IDLE); setResultImage(null); setHistory([]); }} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"><RotateCcw size={18} /></button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[400px] bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-40 shrink-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <section className="space-y-4">
              <h3 className="text-sm font-black italic uppercase tracking-wider text-slate-300 flex items-center"><Layout className="mr-2" size={16} /> 1. お手本の分析</h3>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-4">
                <ImageUploader label="参考画像の添付" images={refImages} onImagesChange={setRefImages} />
                {(status === AppStatus.IDLE || status === AppStatus.ANALYZING) && (
                  <Button onClick={handleAnalyze} isLoading={status === AppStatus.ANALYZING} className="w-full h-12">分析を開始する <ChevronRight className="ml-2" size={16} /></Button>
                )}
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-sm font-black italic uppercase tracking-wider text-slate-300 flex items-center"><CheckCircle2 className="mr-2" size={16} /> 2. 素材提供</h3>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-6">
                <ImageUploader label="商品素材" images={assetImages} onImagesChange={setAssetImages} />
                <textarea className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-4 text-xs font-medium focus:ring-1 ring-brand-500/50 outline-none h-24 resize-none text-slate-300" placeholder="追加のこだわり..." value={userRequest} onChange={(e) => setUserRequest(e.target.value)} />
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-sm font-black italic uppercase tracking-wider text-slate-300 flex items-center"><Settings2 className="mr-2" size={16} /> 3. サイズ設定</h3>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {SIZES.map(s => (
                    <button key={s.id} onClick={() => { setSelectedSizeId(s.id); setDimensions({ width: s.w, height: s.h }); }} className={`py-3 px-1 rounded-lg text-[9px] font-black border transition-all ${selectedSizeId === s.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'}`}>{s.label}</button>
                  ))}
                </div>
              </div>
            </section>
            <div className="pt-6 border-t border-slate-800">
              <Button onClick={strategy ? handleGenerateInitial : handleAnalyze} isLoading={status === AppStatus.ANALYZING || status === AppStatus.GENERATING} className="w-full h-14 text-lg">{strategy ? '画像を新規生成' : '分析を開始'} <Sparkles className="ml-2" /></Button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          {history.length > 0 && (
            <div className="h-20 bg-slate-900/50 border-b border-slate-800 flex items-center px-8 space-x-4 shrink-0 overflow-x-auto">
              {history.map((h, i) => (
                <button key={i} onClick={() => { setCurrentIndex(i); setResultImage(h.imageUrl); }} className={`w-12 h-12 rounded-lg border-2 shrink-0 overflow-hidden ${currentIndex === i ? 'border-brand-500 scale-110' : 'border-slate-800 opacity-40'}`}><img src={`data:image/png;base64,${h.imageUrl}`} className="w-full h-full object-cover" /></button>
              ))}
            </div>
          )}

          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex-1 bg-slate-900/30 rounded-[2.5rem] border border-slate-800/50 flex flex-col items-center justify-center relative overflow-y-auto">
              {status === AppStatus.REVIEWING_STRATEGY && strategy && (
                <div className="w-full max-w-4xl p-12 space-y-10 text-center animate-in fade-in slide-in-from-bottom-4">
                  <div className="space-y-2">
                    <h2 className="text-5xl font-black italic tracking-tighter text-white">SUCCESS DNA</h2>
                    <p className="text-slate-400 font-bold">参考画像から「売れる理由」を抽出しました。</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800"><p className="text-brand-500 font-black text-[10px] uppercase mb-2 tracking-widest">Target</p><p className="text-sm font-medium">{strategy.target}</p></div>
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800"><p className="text-brand-500 font-black text-[10px] uppercase mb-2 tracking-widest">DNA</p><p className="text-sm font-medium">{strategy.valueProp}</p></div>
                    <div className="bg-brand-600 p-6 rounded-3xl md:col-span-2 text-white"><p className="text-white/70 font-black text-[10px] uppercase mb-2 tracking-widest">Copy Suggestion</p><p className="text-xl font-black italic">{strategy.copySuggestion}</p></div>
                  </div>
                  <Button onClick={handleGenerateInitial} className="px-12 h-16 text-xl">この戦略で生成を開始 <ChevronRight className="ml-2" /></Button>
                </div>
              )}
              {(status === AppStatus.ANALYZING || status === AppStatus.GENERATING) && (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-brand-500 font-black italic animate-pulse">{status === AppStatus.ANALYZING ? "DECODING DNA..." : "RENDERING..."}</p>
                </div>
              )}
              {resultImage && status !== AppStatus.REVIEWING_STRATEGY && (
                <div className="w-full h-full p-8 flex items-center justify-center relative group">
                  <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-white/5 max-h-full" style={{ aspectRatio: `${dimensions.width}/${dimensions.height}` }}>
                    <img src={`data:image/png;base64,${resultImage}`} className="w-full h-full object-contain bg-slate-950" alt="Generated" />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-6">
                      <button onClick={() => { const l = document.createElement('a'); l.href = `data:image/png;base64,${resultImage}`; l.download = 'fv.png'; l.click(); }} className="bg-brand-600 p-5 rounded-full hover:scale-110 transition-transform"><Download size={32} /></button>
                      <button onClick={() => setIsMaximized(true)} className="bg-slate-800 p-5 rounded-full hover:scale-110 transition-transform"><Maximize2 size={32} /></button>
                    </div>
                  </div>
                </div>
              )}
              {resultImage && (
                <div className="w-full p-6 border-t border-slate-800 bg-slate-900/50 shrink-0">
                  <div className="max-w-4xl mx-auto flex space-x-2">
                    <input type="text" className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold outline-none text-white focus:ring-1 ring-brand-500" placeholder="修正指示をどうぞ..." value={adjustment} onChange={e => setAdjustment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdjust()} />
                    <Button onClick={handleAdjust} className="rounded-2xl px-8 h-14">修正実行</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isMaximized && resultImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-10 animate-in fade-in">
          <button onClick={() => setIsMaximized(false)} className="absolute top-10 right-10 text-white/50 hover:text-white"><X size={48} /></button>
          <img src={`data:image/png;base64,${resultImage}`} className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
      {error && <div className="absolute bottom-10 right-10 bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-2xl font-black text-xs flex items-center"><AlertCircle size={16} className="mr-2" />{error}</div>}
    </div>
  );
};

export default App;
