
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedImage, AppStatus, SuccessStrategy, GenerationHistory } from './types';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { 
  Sparkles, 
  RotateCcw, 
  Download, 
  AlertCircle,
  TrendingUp,
  Layout,
  MessageSquareText,
  Maximize2,
  RefreshCw,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
  Layers,
  Eraser,
  AlertTriangle,
  Info,
  Target,
  Trophy,
  History,
  Undo2,
  Type as TypeIcon,
  WifiOff,
  CheckCircle2
} from 'lucide-react';

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (maxRetries > 0 && (error.message?.includes('503') || error.message?.includes('Deadline') || error.message?.includes('unavailable'))) {
      console.warn(`API error (503). Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, maxRetries - 1, delay * 2);
    }
    throw error;
  }
}

const getClosestAspectRatio = (width: number, height: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  if (width <= 0 || height <= 0) return "1:1";
  const ratio = width / height;
  const supported: { name: "1:1" | "3:4" | "4:3" | "9:16" | "16:9"; value: number }[] = [
    { name: '1:1', value: 1.0 }, { name: '3:4', value: 0.75 }, { name: '4:3', value: 1.333 }, { name: '9:16', value: 0.5625 }, { name: '16:9', value: 1.777 },
  ];
  return supported.reduce((prev, curr) => Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev).name;
};

async function analyzeSuccessDNA(referenceImages: UploadedImage[]): Promise<SuccessStrategy> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  const imageParts = referenceImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64Data } }));

  const prompt = `あなたは成果を出すデザインのプロです。参考画像から以下の要素を抽出してください：
1. 【target】悩みの深掘りと視覚フック。
2. 【valueProp】優先順位。目立たせるべきキーワード。
3. 【visualHierarchy】高いジャンプ率の設計（文字の動き、装飾、袋文字、3D感）。
4. 【colorStrategy】行動を促す配色。
5. 【copySuggestion】タイポグラフィの癖を再現する指示。`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...imageParts, { text: prompt }] },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            target: { type: Type.STRING },
            valueProp: { type: Type.STRING },
            visualHierarchy: { type: Type.STRING },
            colorStrategy: { type: Type.STRING },
            copySuggestion: { type: Type.STRING },
          },
          required: ["target", "valueProp", "visualHierarchy", "colorStrategy", "copySuggestion"]
        },
        thinkingConfig: { thinkingBudget: 12000 }
      }
    });
    return JSON.parse(response.text || "{}") as SuccessStrategy;
  });
}

async function generateFinalFV(
  strategy: SuccessStrategy,
  assetImages: UploadedImage[],
  userRequest: string,
  adjustmentRequest: string,
  dimensions: { width: number; height: number },
  genMode: 'final' | 'background',
  previousImage?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-image-preview';
  const assetParts = assetImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64Data } }));
  const mappedRatio = getClosestAspectRatio(dimensions.width, dimensions.height);

  let prompt = "";
  const contentParts: any[] = [...assetParts];
  const dnaInstructions = `【デザインDNA】- ターゲット: ${strategy.target} - 視覚優先順位: ${strategy.visualHierarchy} - 配色: ${strategy.colorStrategy} - 文字装飾: ${strategy.copySuggestion}`;

  if (previousImage) {
    contentParts.push({ inlineData: { mimeType: 'image/png', data: previousImage } });
    if (genMode === 'background') {
      prompt = `【背景抽出：厳格モード】現在の画像から全テキスト、バッジ、装飾文字を「一文字残らず」完全消去してください。消去した跡は、元の背景テクスチャやライティングと100%一致するように補完してください。人物や商品の配置・質感は絶対に変えないでください。指示：${adjustmentRequest || "背景のみにする"}`;
    } else {
      prompt = `【精密デザイン修正：全リクエスト遂行指示】添付の画像を「マスター」として固定し、以下の修正リストをすべて反映した画像を出力してください。修正指示リスト：\n${adjustmentRequest}\n\n【生成AIへの重要ルール：改変の制限】1. 「指示された箇所以外」は1ピクセルも変更しないでください。背景、人物、商品の質感、光の方向、他の文字の位置などはマスター画像を100%維持してください。2. 複数指示がある場合、すべての指示を個別に認識し、一つも漏らさずに同時反映してください。3. 部分削除指示：その文字のみをピンポイントで消し、背景のテクスチャで自然に埋めてください。4. サイズ/配置変更：フォント、色、立体感（エフェクト）を完全に維持したまま、サイズと位置だけを変えてください。\n\nデザインDNA情報：\n${dnaInstructions}`;
    }
  } else {
    prompt = genMode === 'background' ? `【新規背景】文字なし高品質背景。DNA:${dnaInstructions} 要望:${userRequest}` : `【新規デザイン】DNA再現率95%以上のFV。DNA:${dnaInstructions} 要望:${userRequest}`;
  }
  contentParts.push({ text: prompt });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contentParts },
      config: { imageConfig: { aspectRatio: mappedRatio, imageSize: "1K" } }
    });
    const b64 = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!b64) throw new Error("画像データが応答に含まれていません。");
    return b64;
  });
}

const SIZES = [{ id: 'std', label: 'PC', w: 1200, h: 900 }, { id: 'sq', label: 'SNS', w: 1080, h: 1080 }, { id: 'pt', label: 'Mobile', w: 1080, h: 1920 }];

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
  const [genMode, setGenMode] = useState<'final' | 'background'>('final');
  const [isExtractingBackground, setIsExtractingBackground] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) { setHasSelectedKey(await window.aistudio.hasSelectedApiKey()); } 
      else { setHasSelectedKey(true); }
    };
    checkKey();
  }, []);

  const handleKeyReset = async () => {
    if (window.aistudio?.openSelectKey) { await window.aistudio.openSelectKey(); setHasSelectedKey(true); }
  };

  const handleAnalyze = async () => {
    if (refImages.length === 0) { setError('デザイン参考画像をアップロードしてください。'); return; }
    setError(''); setStatus(AppStatus.ANALYZING);
    try {
      const s = await analyzeSuccessDNA(refImages);
      setStrategy(s); setStatus(AppStatus.REVIEWING_STRATEGY);
    } catch (e: any) { 
      setError(e.message?.includes('503') || e.message?.includes('Deadline') ? 'AIサーバーが混雑しています。少し待ってから再度「DNA精密分析」を実行してください。' : e.message);
      setStatus(AppStatus.ERROR); 
    }
  };

  const handleGenerateInitial = async () => {
    if (!strategy) return;
    setError(''); setStatus(AppStatus.GENERATING); setGenMode('final');
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, "", dimensions, 'final');
      updateHistory(b64, 'final'); setStatus(AppStatus.SUCCESS);
    } catch (e: any) { 
      setError(e.message?.includes('503') || e.message?.includes('Deadline') ? '生成に時間がかかりすぎています。もう一度「デザインを生成」を押してください。' : e.message);
      setStatus(AppStatus.ERROR); 
    }
  };

  const handleAdjust = async () => {
    if (!strategy || currentIndex === -1) return;
    if (!adjustment.trim()) { setError('修正内容を入力してください。'); return; }
    setError(''); setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, adjustment, dimensions, genMode, history[currentIndex].imageUrl);
      updateHistory(b64, genMode); setStatus(AppStatus.SUCCESS); setAdjustment('');
    } catch (e: any) { 
      setError(e.message?.includes('503') || e.message?.includes('Deadline') ? 'サーバー応答がありません。通信環境を確認し、再度「修正を反映」してください。' : e.message);
      setStatus(AppStatus.ERROR); 
    }
  };

  const handleExtractBackground = async () => {
    if (!strategy || currentIndex === -1 || !resultImage) return;
    setIsExtractingBackground(true); setError('');
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, "すべての文字を完全消去。背景のみを抽出する", dimensions, 'background', resultImage);
      updateHistory(b64, 'background'); setIsExtractingBackground(false);
    } catch (e: any) { setError('背景抽出に失敗しました。再度お試しください。'); setIsExtractingBackground(false); }
  };

  const updateHistory = (imageUrl: string, mode: 'final' | 'background') => {
    const entry = { imageUrl, dimensions: { ...dimensions }, strategy: { ...strategy! } };
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(entry);
    setHistory(newHistory); setCurrentIndex(newHistory.length - 1);
    setResultImage(imageUrl); setGenMode(mode);
  };

  const navigateHistory = (dir: 'prev' | 'next') => {
    let nextIdx = currentIndex;
    if (dir === 'prev' && currentIndex > 0) nextIdx--;
    if (dir === 'next' && currentIndex < history.length - 1) nextIdx++;
    if (nextIdx !== currentIndex) { setCurrentIndex(nextIdx); setResultImage(history[nextIdx].imageUrl); }
  };

  const updateDimensions = (field: 'width' | 'height', val: string) => {
    const n = parseInt(val) || 0;
    setDimensions(prev => ({ ...prev, [field]: n }));
    setSelectedSizeId('custom');
  };

  if (!hasSelectedKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-12 text-center space-y-8">
        <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter">PIXELPERFECT FV</h1>
        <Button onClick={handleKeyReset} className="px-12 py-6 rounded-2xl text-xl shadow-2xl">APIキーを選択して開始</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 flex flex-col overflow-hidden">
      <header className="bg-slate-950 border-b border-slate-800 h-16 px-8 flex items-center justify-between shrink-0 z-50 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white shadow-lg"><TrendingUp size={20} /></div>
          <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">PIXEL<span className="text-brand-500">PERFECT</span> FV</h1>
        </div>
        <div className="flex items-center space-x-4">
          {genMode === 'background' && (
            <div className="flex items-center bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              <Layers size={12} className="mr-2" /> Background Mode
            </div>
          )}
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white" title="リセット"><RotateCcw size={18} /></button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-8 py-4 flex items-center text-red-400 text-xs font-bold animate-in slide-in-from-top duration-300">
          <WifiOff size={16} className="mr-4 shrink-0" />
          <div className="flex-1">
            <p className="uppercase tracking-tighter text-[10px] opacity-70 mb-0.5">Connection Warning</p>
            <p>{error}</p>
          </div>
          <button onClick={() => setError('')} className="ml-6 hover:text-white underline text-[10px] font-black uppercase tracking-widest">Dismiss</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col p-8 space-y-8 overflow-y-auto custom-scrollbar shadow-2xl shrink-0">
          <ImageUploader label="STEP 1: デザイン参考画像" images={refImages} onImagesChange={setRefImages} />
          <ImageUploader label="STEP 2: あなたの素材画像 (任意)" images={assetImages} onImagesChange={setAssetImages} />
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center"><Layout className="mr-2" size={12} /> STEP 3: 出力サイズ設定</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map(s => (
                <button key={s.id} onClick={() => { setSelectedSizeId(s.id); setDimensions({ width: s.w, height: s.h }); }} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${selectedSizeId === s.id ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{s.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-600 font-bold uppercase ml-1">Width</span>
                <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:ring-1 ring-brand-500/50" value={dimensions.width} onChange={(e) => updateDimensions('width', e.target.value)} placeholder="W" />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-600 font-bold uppercase ml-1">Height</span>
                <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:ring-1 ring-brand-500/50" value={dimensions.height} onChange={(e) => updateDimensions('height', e.target.value)} placeholder="H" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center"><MessageSquareText className="mr-2" size={12} /> STEP 4: コピー・優先指示</label>
            <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-300 outline-none focus:ring-2 ring-brand-500/50 min-h-[100px] placeholder:text-slate-700" placeholder="心に刺さるコピーや、必ず入れて欲しい要素を具体的に指示してください。" value={userRequest} onChange={(e) => setUserRequest(e.target.value)} />
          </div>
          <Button onClick={strategy ? handleGenerateInitial : handleAnalyze} isLoading={status === AppStatus.ANALYZING || status === AppStatus.GENERATING} className="w-full h-16 rounded-2xl text-lg shadow-xl">
            {strategy ? 'デザインを生成' : 'DNA精密分析を開始'} <Sparkles className="ml-2" />
          </Button>
        </aside>

        <main className="flex-1 flex flex-col bg-[#010413] relative items-center justify-center p-10 overflow-hidden">
          {status === AppStatus.ANALYZING || status === AppStatus.GENERATING || isExtractingBackground ? (
            <div className="text-center space-y-10 animate-pulse">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 border-[8px] border-brand-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-[8px] border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="space-y-3">
                <p className="text-3xl font-black italic tracking-widest text-brand-500 uppercase">{isExtractingBackground ? "REFRACTION..." : status === AppStatus.ANALYZING ? "SEQUENCING DNA..." : "RENDERING..."}</p>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">AI is processing complex visual logic</p>
              </div>
            </div>
          ) : resultImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
              <div className="w-full max-w-4xl flex justify-between items-center mb-6">
                <button onClick={() => setStatus(AppStatus.REVIEWING_STRATEGY)} className="text-xs font-bold text-slate-400 hover:text-white flex items-center uppercase bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800 transition-all hover:bg-slate-800"><ArrowLeft size={14} className="mr-2" /> 設計図へ</button>
                <div className="flex items-center space-x-4">
                  {history.length > 1 && (
                    <div className="flex items-center space-x-4 bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800">
                      <button onClick={() => navigateHistory('prev')} disabled={currentIndex === 0} className="disabled:opacity-20 hover:text-brand-500 transition-colors"><Undo2 size={18} /></button>
                      <span className="text-[10px] font-black text-slate-500">{currentIndex + 1} / {history.length}</span>
                      <button onClick={() => navigateHistory('next')} disabled={currentIndex === history.length - 1} className="disabled:opacity-20 hover:text-brand-500 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                  )}
                  {genMode === 'final' ? (
                    <button onClick={handleExtractBackground} className="flex items-center text-[10px] font-black text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl border border-slate-700 shadow-lg uppercase transition-all">
                      <Eraser size={14} className="mr-2 text-emerald-400" /> 背景素材を抽出
                    </button>
                  ) : (
                    <button onClick={() => setGenMode('final')} className="flex items-center text-[10px] font-black text-white bg-brand-600/20 hover:bg-brand-600/40 px-4 py-2 rounded-xl border border-brand-500/30 shadow-lg uppercase transition-all">
                      <Layers size={14} className="mr-2 text-brand-400" /> デザインモード
                    </button>
                  )}
                </div>
              </div>
              <div className="relative group max-h-[70%] rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black flex items-center justify-center">
                <img src={`data:image/png;base64,${resultImage}`} className="max-h-full max-w-full object-contain" alt="Generated" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button onClick={() => { const a = document.createElement('a'); a.href = `data:image/png;base64,${resultImage}`; a.download = `fv-export-${Date.now()}.png`; a.click(); }} className="bg-brand-600 p-8 rounded-2xl text-white shadow-2xl hover:scale-105 transition-transform flex flex-col items-center">
                    <Download size={40} />
                    <span className="block text-xs mt-3 font-black uppercase tracking-widest">Download PNG</span>
                  </button>
                </div>
              </div>
              <div className="mt-8 w-full max-w-3xl flex flex-col space-y-2">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4 backdrop-blur-xl shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-[10px] text-brand-400 font-black uppercase tracking-widest">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>複数指示を確実に行うコツ</span>
                    </div>
                    <div className="flex space-x-4 text-[9px] text-slate-500 font-bold uppercase italic">
                      <span>• 指示は箇条書きにする</span>
                      <span>• 指示外は変えないよう記述</span>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <textarea className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-bold outline-none resize-none min-h-[80px] focus:ring-2 ring-brand-500/50 transition-all placeholder:text-slate-700 text-slate-200" value={adjustment} onChange={e => setAdjustment(e.target.value)} placeholder={"例：\n・「○○」という文字を削除\n・左下のバッジを1.5倍に大きく\n・背景の色味はそのままで人物を右に少し移動\n※箇条書きにすると全ての指示が反映されやすくなります"} />
                    <Button onClick={handleAdjust} className="px-10 h-auto py-4 rounded-2xl shadow-lg border border-brand-500/20 active:scale-95 leading-tight">すべての<br/>指示を反映</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : strategy ? (
            <div className="max-w-3xl w-full space-y-10 animate-in fade-in duration-700 overflow-y-auto max-h-full custom-scrollbar pb-10 px-4">
              <div className="text-center space-y-2">
                <h2 className="text-5xl font-black italic tracking-tighter uppercase flex items-center justify-center">
                   <Trophy className="mr-4 text-brand-500" size={40} /> Design DNA
                </h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">成果を生むデザイン設計図</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(strategy).map(([key, val]) => (
                  <div key={key} className={`bg-slate-900/50 p-6 rounded-3xl border border-slate-800 transition-all hover:border-slate-700 ${key === 'copySuggestion' || key === 'visualHierarchy' ? 'col-span-2 bg-brand-600/5 border-brand-500/10' : ''}`}>
                    <p className="text-brand-500 font-black text-[10px] uppercase tracking-widest mb-2 flex items-center">{key} <Edit3 size={10} className="ml-2 opacity-30" /></p>
                    <textarea className="w-full bg-transparent text-sm font-bold text-slate-300 outline-none min-h-[80px] custom-scrollbar" value={val} onChange={(e) => setStrategy({...strategy, [key]: e.target.value})} />
                  </div>
                ))}
              </div>
              <div className="flex justify-center flex-col items-center space-y-4">
                <Button onClick={handleGenerateInitial} className="px-20 h-20 text-2xl rounded-3xl shadow-2xl hover:scale-105 transition-all bg-gradient-to-r from-brand-600 to-brand-700">高精度デザイン生成</Button>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">※生成には約30〜60秒かかります</p>
              </div>
            </div>
          ) : (
            <div className="text-center opacity-10 pointer-events-none select-none">
              <Target size={140} className="mx-auto mb-6 text-slate-500" />
              <p className="text-7xl font-black italic text-slate-500 uppercase tracking-tighter">Analysis Required</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
