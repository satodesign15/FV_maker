
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
 * --- 高精度ロジック統合セクション ---
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

async function analyzeSuccessDNA(referenceImages: UploadedImage[]): Promise<SuccessStrategy> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  const imageParts = referenceImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const prompt = `あなたは世界最高峰のクリエイティブディレクターです。
添付された参考画像（ファーストビュー）の「売れるDNA」をピクセル単位で分析してください。

以下の5つの要素を厳密に抽出してJSONで返してください：
1. target: 誰の、どんな深い悩みに刺そうとしているデザインか
2. valueProp: ユーザーが0.5秒で理解する「最大の便益」
3. visualHierarchy: 視線誘導（Z型・F型）、余白（ネガティブスペース）の使い方、要素の重なり順
4. colorStrategy: メイン・アクセント・ベースカラーの比率と、それによる心理的効果
5. copySuggestion: この構成で、新商品に適用する場合の「勝てる」キャッチコピー（煽り・実績・ベネフィットの黄金比）

出力は必ず純粋なJSON形式のみとしてください。`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: { 
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 16000 } // 深く思考させることで再現性を向上
    }
  });

  try {
    return JSON.parse(response.text || "{}") as SuccessStrategy;
  } catch (e) {
    throw new Error("DNA分析データの解析に失敗しました。");
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

  let prompt = "";
  const contentParts: any[] = [...assetParts];

  if (previousImage) {
    contentParts.push({ inlineData: { mimeType: 'image/png', data: previousImage } });
    prompt = `【画像改善指示】前回の結果をベースに微調整してください。
修正リクエスト: ${userRequest}
アスペクト比は ${mappedRatio} を維持。`;
  } else {
    prompt = `【究極の再現性指令】
あなたはフォトリアルな合成とタイポグラフィの天才です。
提供された素材を使い、以下の戦略に基づいた「売れるファーストビュー」を生成してください。

■再現ターゲット（95%一致）
・参考画像のレイアウト、文字の配置バランス、ライティング、空気感を徹底的に模倣せよ。
・構図DNA: ${strategy.visualHierarchy}
・色彩DNA: ${strategy.colorStrategy}

■コンテンツ内容
・ターゲット: ${strategy.target}
・メインコピー: 「${strategy.copySuggestion}」
・ユーザー要望: ${userRequest}

■技術仕様
・アスペクト比: ${mappedRatio}
・質感: 高解像度、プロ仕様のライティング、商業広告レベルのレタッチ
・合成: 素材画像が背景や全体の世界観と完璧に馴染んでいること。`;
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
  throw new Error("画像のレンダリングに失敗しました。");
}

/**
 * --- メイン UI コンポーネント ---
 */

const SIZES = [
  { id: 'std', label: 'Desktop (1200x900)', w: 1200, h: 900 },
  { id: 'sq', label: 'Instagram (1080x1080)', w: 1080, h: 1080 },
  { id: 'pt', label: 'Mobile Story (1080x1920)', w: 1080, h: 1920 },
  { id: 'wd', label: 'YouTube (1920x1080)', w: 1920, h: 1080 },
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
    if (refImages.length === 0) { setError('分析用の参考画像をアップロードしてください。'); return; }
    setError(''); setStatus(AppStatus.ANALYZING);
    try {
      const s = await analyzeSuccessDNA(refImages);
      setStrategy(s); setStatus(AppStatus.REVIEWING_STRATEGY);
    } catch (e: any) { 
      console.error(e);
      setStatus(AppStatus.ERROR); 
      setError('分析中にエラーが発生しました。APIキーまたは接続を確認してください。'); 
    }
  };

  const handleGenerateInitial = async () => {
    if (!strategy || assetImages.length === 0) { setError('商品素材をアップロードしてください。'); return; }
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, dimensions);
      const entry = { imageUrl: b64, dimensions: { ...dimensions }, strategy: { ...strategy } };
      const newHistory = [...history.slice(0, currentIndex + 1), entry];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setResultImage(b64);
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) { 
      console.error(e);
      setStatus(AppStatus.ERROR); 
      setError('生成に失敗しました。素材の形式を確認してください。'); 
    }
  };

  const handleAdjust = async () => {
    if (!strategy || currentIndex === -1) return;
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, adjustment || "微調整", dimensions, history[currentIndex].imageUrl);
      const entry = { imageUrl: b64, dimensions: { ...dimensions }, strategy: { ...strategy } };
      const newHistory = [...history.slice(0, currentIndex + 1), entry];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setResultImage(b64);
      setStatus(AppStatus.SUCCESS);
      setAdjustment('');
    } catch (e: any) { setStatus(AppStatus.ERROR); setError(e.message); }
  };

  if (!hasSelectedKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 rounded-[3rem] shadow-2xl p-12 space-y-8 border border-white/5">
          <div className="w-24 h-24 bg-brand-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-brand-500/20"><Zap className="text-white" size={48} /></div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Strategic Analysis</h2>
            <p className="text-slate-400 text-sm">有料プランのAPIキーが設定されていません。</p>
          </div>
          <Button onClick={async () => { await window.aistudio?.openSelectKey(); setHasSelectedKey(true); }} className="w-full py-6 rounded-2xl text-xl">認証をリクエスト</Button>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Encrypted & Secure</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 h-16 px-8 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white shadow-lg shadow-brand-600/30"><TrendingUp size={20} /></div>
          <h1 className="text-xl font-black italic tracking-tighter text-white">PIXEL<span className="text-brand-500">PERFECT</span> FV</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Online</span>
          <button onClick={() => { setStatus(AppStatus.IDLE); setResultImage(null); setHistory([]); setStrategy(null); }} className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white hover:rotate-180 duration-500"><RotateCcw size={18} /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-40 shrink-0">
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black italic uppercase tracking-[0.2em] text-brand-500 flex items-center"><MousePointer2 className="mr-2" size={14} /> Step 01. Analyze DNA</h3>
              </div>
              <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 space-y-4">
                <ImageUploader label="お手本の画像（売れているFV）" images={refImages} onImagesChange={setRefImages} />
                {(status === AppStatus.IDLE || status === AppStatus.ANALYZING) && (
                  <Button onClick={handleAnalyze} isLoading={status === AppStatus.ANALYZING} className="w-full h-14 rounded-2xl">DNA抽出を開始 <ChevronRight className="ml-2" size={16} /></Button>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-xs font-black italic uppercase tracking-[0.2em] text-brand-500 flex items-center"><CheckCircle2 className="mr-2" size={14} /> Step 02. Inject Assets</h3>
              <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 space-y-6">
                <ImageUploader label="あなたの商品素材" images={assetImages} onImagesChange={setAssetImages} />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Additional Request</label>
                  <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-bold focus:ring-2 ring-brand-500/20 outline-none h-24 resize-none text-slate-300 placeholder:text-slate-700" placeholder="例：もう少し高級感を出して、人物を中央に..." value={userRequest} onChange={(e) => setUserRequest(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-xs font-black italic uppercase tracking-[0.2em] text-brand-500 flex items-center"><Settings2 className="mr-2" size={14} /> Step 03. Format</h3>
              <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {SIZES.map(s => (
                    <button key={s.id} onClick={() => { setSelectedSizeId(s.id); setDimensions({ width: s.w, height: s.h }); }} className={`py-4 px-2 rounded-2xl text-[9px] font-black border transition-all ${selectedSizeId === s.id ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-600/20 scale-[1.02]' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}>{s.label}</button>
                  ))}
                </div>
              </div>
            </section>

            <div className="pt-8">
              <Button onClick={strategy ? handleGenerateInitial : handleAnalyze} isLoading={status === AppStatus.ANALYZING || status === AppStatus.GENERATING} className="w-full h-16 rounded-[1.5rem] text-xl shadow-2xl shadow-brand-600/20">
                {strategy ? 'GENERATE FINAL FV' : 'START ANALYSIS'} <Sparkles className="ml-2" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-[#010413] relative overflow-hidden">
          {/* Timeline / History */}
          {history.length > 0 && (
            <div className="h-24 bg-slate-950/50 border-b border-slate-800 flex items-center px-10 space-x-6 shrink-0 overflow-x-auto custom-scrollbar">
              <div className="flex items-center space-x-2 mr-4 border-r border-slate-800 pr-6 h-10">
                <History size={16} className="text-slate-500" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">History</span>
              </div>
              {history.map((h, i) => (
                <button key={i} onClick={() => { setCurrentIndex(i); setResultImage(h.imageUrl); }} className={`w-14 h-14 rounded-xl border-2 shrink-0 transition-all overflow-hidden ${currentIndex === i ? 'border-brand-500 scale-110 shadow-lg shadow-brand-500/40' : 'border-slate-800 opacity-30 hover:opacity-100'}`}><img src={`data:image/png;base64,${h.imageUrl}`} className="w-full h-full object-cover" /></button>
              ))}
            </div>
          )}

          <div className="flex-1 flex flex-col p-10 overflow-hidden">
            <div className="flex-1 bg-slate-900/20 rounded-[4rem] border border-slate-800/50 flex flex-col items-center justify-center relative overflow-y-auto backdrop-blur-3xl shadow-inner">
              
              {/* Strategy Report View */}
              {status === AppStatus.REVIEWING_STRATEGY && strategy && (
                <div className="w-full max-w-4xl p-16 space-y-12 animate-in fade-in zoom-in-95 duration-700">
                  <div className="text-center space-y-4">
                    <div className="inline-block px-4 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-[10px] font-black uppercase tracking-[0.3em]">Analysis Complete</div>
                    <h2 className="text-6xl font-black italic tracking-tighter text-white">GENETIC BLUEPRINT</h2>
                    <p className="text-slate-400 font-bold max-w-2xl mx-auto">参考画像から抽出した「勝利の構造」です。このDNAを元に画像を生成します。</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 space-y-4 hover:border-brand-500/50 transition-colors">
                      <div className="w-10 h-10 bg-brand-600/20 rounded-2xl flex items-center justify-center text-brand-500"><Target size={20} /></div>
                      <div>
                        <p className="text-brand-500 font-black text-[10px] uppercase mb-1 tracking-widest">Target Audience</p>
                        <p className="text-sm font-bold leading-relaxed">{strategy.target}</p>
                      </div>
                    </div>
                    <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 space-y-4 hover:border-brand-500/50 transition-colors">
                      <div className="w-10 h-10 bg-brand-600/20 rounded-2xl flex items-center justify-center text-brand-500"><Palette size={20} /></div>
                      <div>
                        <p className="text-brand-500 font-black text-[10px] uppercase mb-1 tracking-widest">Visual DNA</p>
                        <p className="text-sm font-bold leading-relaxed">{strategy.visualHierarchy}</p>
                      </div>
                    </div>
                    <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 space-y-4 hover:border-brand-500/50 transition-colors">
                      <div className="w-10 h-10 bg-brand-600/20 rounded-2xl flex items-center justify-center text-brand-500"><TypeIcon size={20} /></div>
                      <div>
                        <p className="text-brand-500 font-black text-[10px] uppercase mb-1 tracking-widest">Core Value</p>
                        <p className="text-sm font-bold leading-relaxed">{strategy.valueProp}</p>
                      </div>
                    </div>
                    <div className="bg-brand-600 p-10 rounded-[3rem] md:col-span-3 text-white shadow-2xl shadow-brand-600/30 flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                      <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shrink-0"><Sparkles size={32} /></div>
                      <div>
                        <p className="text-white/70 font-black text-[10px] uppercase mb-2 tracking-widest">Suggested Catchcopy</p>
                        <p className="text-3xl font-black italic leading-tight">「{strategy.copySuggestion}」</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center pt-6">
                    <Button onClick={handleGenerateInitial} className="px-16 h-20 text-2xl rounded-3xl shadow-2xl hover:scale-105 transition-transform">この戦略で生成を開始 <ChevronRight className="ml-2" size={24} /></Button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {(status === AppStatus.ANALYZING || status === AppStatus.GENERATING) && (
                <div className="text-center space-y-10 animate-pulse">
                  <div className="relative">
                    <div className="w-32 h-32 border-[12px] border-brand-500/10 border-t-brand-500 rounded-full animate-spin mx-auto shadow-2xl"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><Zap size={40} className="text-brand-500 animate-bounce" /></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-black italic text-white tracking-widest">{status === AppStatus.ANALYZING ? "DECODING DNA..." : "RENDERING..."}</p>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.5em]">{status === AppStatus.ANALYZING ? "Deep Analysis in Progress" : "Assembling High-Resolution Pixels"}</p>
                  </div>
                </div>
              )}

              {/* Result View */}
              {resultImage && status !== AppStatus.REVIEWING_STRATEGY && (
                <div className="w-full h-full p-10 flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-1000">
                  <div className="flex-1 flex items-center justify-center relative group min-h-0">
                    <div className="relative shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] rounded-[3rem] overflow-hidden border border-white/5 bg-black" style={{ aspectRatio: `${dimensions.width}/${dimensions.height}`, maxHeight: '80%' }}>
                      <img src={`data:image/png;base64,${resultImage}`} className="w-full h-full object-contain" alt="Generated" />
                      
                      <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center space-x-8">
                        <button onClick={() => { const l = document.createElement('a'); l.href = `data:image/png;base64,${resultImage}`; l.download = 'pixelperfect-fv.png'; l.click(); }} className="bg-brand-600 p-8 rounded-[2rem] hover:scale-110 transition-transform shadow-2xl text-white"><Download size={48} /></button>
                        <button onClick={() => setIsMaximized(true)} className="bg-slate-800 p-8 rounded-[2rem] hover:scale-110 transition-transform shadow-2xl text-white"><Maximize2 size={48} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Adjustment Input */}
                  <div className="w-full max-w-4xl mx-auto mt-12 mb-4">
                    <div className="bg-slate-900/80 p-3 rounded-[2.5rem] border border-slate-800 shadow-2xl flex space-x-4 backdrop-blur-xl">
                      <div className="flex-1 relative">
                        <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] px-8 py-5 text-sm font-bold outline-none text-white focus:ring-2 ring-brand-500/50 placeholder:text-slate-700" placeholder="さらに修正指示を加える（例：テキストを右側に、背景をもっと明るく）" value={adjustment} onChange={e => setAdjustment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdjust()} />
                        <Sparkles className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-800" size={20} />
                      </div>
                      <Button onClick={handleAdjust} className="rounded-[1.8rem] px-10 h-16 shadow-xl">修正実行</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle View */}
              {status === AppStatus.IDLE && (
                <div className="text-center space-y-8 animate-in fade-in duration-1000">
                  <div className="w-32 h-32 bg-slate-800/20 rounded-[3rem] flex items-center justify-center mx-auto border border-white/5"><Layout size={64} className="text-slate-700" /></div>
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black italic text-slate-700 tracking-tighter">WAITING FOR INPUT</h2>
                    <p className="text-slate-500 font-bold text-sm max-w-md mx-auto">左側のサイドパネルから参考画像をアップロードし、分析を開始してください。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Fullscreen Overlay */}
      {isMaximized && resultImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-20 animate-in fade-in duration-300">
          <button onClick={() => setIsMaximized(false)} className="absolute top-12 right-12 text-white/30 hover:text-white transition-colors hover:rotate-90 duration-300"><X size={64} /></button>
          <img src={`data:image/png;base64,${resultImage}`} className="max-w-full max-h-full object-contain rounded-[2rem] shadow-[0_0_100px_rgba(14,165,233,0.1)]" />
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-12 right-12 bg-red-500/10 border border-red-500/50 text-red-400 px-8 py-5 rounded-[2rem] font-black text-xs flex items-center shadow-2xl animate-in slide-in-from-right-10 backdrop-blur-xl">
          <AlertCircle size={20} className="mr-3" />
          {error}
          <button onClick={() => setError('')} className="ml-4 hover:text-white"><X size={14} /></button>
        </div>
      )}
    </div>
  );
};

export default App;
