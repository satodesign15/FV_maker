
import React, { useState, useEffect } from 'react';
import { UploadedImage, AppStatus, SuccessStrategy, GenerationHistory } from './types';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { analyzeSuccessDNA, generateFinalFV } from './services/geminiService';
import { 
  Sparkles, 
  RotateCcw, 
  Download, 
  AlertCircle,
  TrendingUp,
  Target,
  Palette,
  Type as TypeIcon,
  ChevronRight,
  ChevronLeft,
  History,
  Layout,
  Settings2,
  Maximize2,
  X,
  Edit3,
  CheckCircle2,
  Zap
} from 'lucide-react';

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
  
  // 履歴管理
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // 拡大表示
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasSelectedKey(selected);
      } else {
        setHasSelectedKey(true);
      }
    };
    checkKey();
  }, []);

  const handleAnalyze = async () => {
    if (refImages.length === 0) {
      setError('お手本（参考画像）をアップロードしてください。');
      return;
    }
    setError('');
    setStatus(AppStatus.ANALYZING);
    try {
      const analyzedStrategy = await analyzeSuccessDNA(refImages);
      setStrategy(analyzedStrategy);
      setStatus(AppStatus.REVIEWING_STRATEGY);
    } catch (e: any) {
      setError(e.message || "分析に失敗しました。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGenerateInitial = async () => {
    if (!strategy) {
      setError('まずはお手本の分析を行ってください。');
      return;
    }
    if (assetImages.length === 0) {
      setError('商品素材をアップロードしてください。');
      return;
    }
    setStatus(AppStatus.GENERATING);
    try {
      const b64 = await generateFinalFV(strategy, assetImages, userRequest, dimensions);
      const newEntry: GenerationHistory = {
        imageUrl: b64,
        dimensions: { ...dimensions },
        strategy: { ...strategy }
      };
      
      const newHistory = [...history.slice(0, currentIndex + 1), newEntry];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setResultImage(b64);
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) {
      setError(e.message || "生成に失敗しました。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleAdjust = async (customInstruction?: string) => {
    if (!strategy || currentIndex === -1) return;
    setStatus(AppStatus.GENERATING);
    try {
      const currentEntry = history[currentIndex];
      const instruction = customInstruction || adjustment || "デザイン・サイズの微調整";
      const b64 = await generateFinalFV(strategy, assetImages, instruction, dimensions, currentEntry.imageUrl);
      
      const newEntry: GenerationHistory = {
        imageUrl: b64,
        dimensions: { ...dimensions },
        strategy: { ...strategy }
      };
      
      const newHistory = [...history.slice(0, currentIndex + 1), newEntry];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setResultImage(b64);
      setStatus(AppStatus.SUCCESS);
      setAdjustment('');
    } catch (e: any) {
      setError(e.message || "修正に失敗しました。");
      setStatus(AppStatus.ERROR);
    }
  };

  const navigateHistory = (index: number) => {
    if (index >= 0 && index < history.length) {
      setCurrentIndex(index);
      const entry = history[index];
      setResultImage(entry.imageUrl);
      setDimensions(entry.dimensions);
      setStrategy(entry.strategy);
      
      const foundSize = SIZES.find(s => s.w === entry.dimensions.width && s.h === entry.dimensions.height);
      setSelectedSizeId(foundSize ? foundSize.id : '');
      
      // Ensure we stay in SUCCESS status during navigation to prevent process reset
      setStatus(AppStatus.SUCCESS);
    }
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${resultImage}`;
    link.download = `pixelperfect-fv-${Date.now()}.png`;
    link.click();
  };

  const restart = () => {
    setStatus(AppStatus.IDLE);
    setResultImage(null);
    setStrategy(null);
    setHistory([]);
    setCurrentIndex(-1);
    setError('');
    setUserRequest('');
    setAdjustment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      handleAdjust();
    }
  };

  const updateStrategyField = (field: keyof SuccessStrategy, value: string) => {
    if (strategy) {
      setStrategy({ ...strategy, [field]: value });
    }
  };

  if (!hasSelectedKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/10">
          <div className="w-20 h-20 bg-brand-600 rounded-3xl mx-auto flex items-center justify-center">
            <Zap className="text-white" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Strategic Analysis Locked</h2>
          <Button 
            onClick={async () => {
              await window.aistudio?.openSelectKey();
              setHasSelectedKey(true);
            }}
            className="w-full py-5 rounded-2xl text-lg"
          >
            認証を開始
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-brand-500/30">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-50 h-16 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white">
            <TrendingUp size={20} />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter leading-none text-white">PixelPerfect <span className="text-brand-500">FV</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={restart} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white" title="最初からやり直す">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[400px] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-40 shrink-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* Step 1 */}
            <section className="space-y-4">
              <h3 className="text-sm font-black italic uppercase tracking-wider text-slate-300 flex items-center">
                <Layout className="mr-2" size={16} /> 1. お手本の分析
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-4">
                <ImageUploader label="参考画像の添付" images={refImages} onImagesChange={setRefImages} />
                {(status === AppStatus.IDLE || status === AppStatus.ANALYZING) && (
                  <Button onClick={handleAnalyze} isLoading={status === AppStatus.ANALYZING} className="w-full h-12">
                    分析を開始する <ChevronRight className="ml-2" size={16} />
                  </Button>
                )}
              </div>
            </section>

            {/* Step 2 */}
            <section className="space-y-4">
              <h3 className="text-sm font-black italic uppercase tracking-wider text-slate-300 flex items-center">
                <CheckCircle2 className={`mr-2 ${strategy ? 'text-brand-500' : 'text-slate-500'}`} size={16} /> 2. 戦略確認と素材提供
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-6">
                {strategy ? (
                  <div className="space-y-3 bg-slate-950/30 p-3 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">
                      <Edit3 size={12} className="mr-2" /> 分析結果の確認・修正
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Target</span>
                        <textarea value={strategy.target} onChange={e => updateStrategyField('target', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-lg p-2 text-[10px] h-12 resize-none focus:ring-1 ring-brand-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">DNA</span>
                        <textarea value={strategy.valueProp} onChange={e => updateStrategyField('valueProp', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-lg p-2 text-[10px] h-12 resize-none focus:ring-1 ring-brand-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Copy</span>
                        <input value={strategy.copySuggestion} onChange={e => updateStrategyField('copySuggestion', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-lg p-2 text-[10px] font-black italic text-brand-400 outline-none" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-slate-700 rounded-xl opacity-30">
                    <Layout size={24} className="mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">ステップ1の分析後に<br/>戦略エディタが表示されます</p>
                  </div>
                )}

                <ImageUploader label="商品素材" images={assetImages} onImagesChange={setAssetImages} />
                <textarea 
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-4 text-xs font-medium focus:ring-1 ring-brand-500/50 outline-none h-24 resize-none text-slate-300"
                  placeholder="追加のこだわりや要望..."
                  value={userRequest}
                  onChange={(e) => setUserRequest(e.target.value)}
                />
              </div>
            </section>

            {/* Step 3 */}
            <section className="space-y-4">
              <h3 className="text-sm font-black italic uppercase tracking-wider text-slate-300 flex items-center">
                <Settings2 className="mr-2" size={16} /> 3. サイズ設定
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {SIZES.map(s => (
                    <button 
                      key={s.id}
                      onClick={() => {
                        setSelectedSizeId(s.id);
                        setDimensions({ width: s.w, height: s.h });
                      }}
                      className={`py-3 px-1 rounded-lg text-[9px] font-black text-center transition-all border ${selectedSizeId === s.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {currentIndex >= 0 && (
                  <Button 
                    onClick={() => handleAdjust("指定サイズに最適化リサイズしてください")}
                    isLoading={status === AppStatus.GENERATING}
                    className="w-full py-2"
                  >
                    リサイズを即時適用
                  </Button>
                )}
              </div>
            </section>

            <div className="pt-6 border-t border-slate-800 space-y-4">
              {(!strategy || status === AppStatus.ANALYZING) ? (
                <Button 
                  onClick={handleAnalyze} 
                  isLoading={status === AppStatus.ANALYZING} 
                  className="w-full h-14 text-lg"
                >
                  お手本を分析する <ChevronRight className="ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleGenerateInitial} 
                  isLoading={status === AppStatus.GENERATING} 
                  className="w-full h-14 text-lg shadow-xl shadow-brand-500/20"
                >
                  画像を新規生成 <Sparkles className="ml-2" />
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
          
          {/* History Navigation */}
          {history.length > 0 && (
            <div className="h-20 bg-slate-900/50 border-b border-slate-800 flex items-center px-8 space-x-4 shrink-0 overflow-hidden">
              <div className="flex items-center space-x-2 text-[10px] font-black text-slate-500 mr-4 uppercase tracking-widest shrink-0">
                <History size={14} /> <span>HISTORY</span>
              </div>
              
              <div className="flex-1 flex items-center space-x-4 overflow-x-auto custom-scrollbar h-full py-2">
                <button 
                  disabled={currentIndex <= 0}
                  onClick={() => navigateHistory(currentIndex - 1)}
                  className="p-2 bg-brand-900/50 hover:bg-brand-600 disabled:opacity-10 disabled:hover:bg-brand-900/50 rounded-lg text-white transition-colors shrink-0 border border-brand-500/30"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center space-x-3">
                  {history.map((h, i) => (
                    <button 
                      key={i}
                      onClick={() => navigateHistory(i)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${currentIndex === i ? 'border-brand-500 scale-110 shadow-lg' : 'border-slate-800 opacity-40 hover:opacity-100'}`}
                    >
                      <img src={`data:image/png;base64,${h.imageUrl}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <button 
                  disabled={currentIndex >= history.length - 1}
                  onClick={() => navigateHistory(currentIndex + 1)}
                  className="p-2 bg-brand-900/50 hover:bg-brand-600 disabled:opacity-10 disabled:hover:bg-brand-900/50 rounded-lg text-white transition-colors shrink-0 border border-brand-500/30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex-1 bg-slate-900/30 rounded-[2.5rem] border border-slate-800/50 flex flex-col min-h-0 relative shadow-inner overflow-y-auto custom-scrollbar">
              
              <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                {/* IDLE state placeholder */}
                {!resultImage && status === AppStatus.IDLE && (
                  <div className="text-center opacity-10">
                    <Layout size={80} className="mx-auto mb-4 text-slate-400" />
                    <p className="text-sm font-black tracking-[0.5em] uppercase">Ready for Creation</p>
                  </div>
                )}

                {/* Strategy Review - High Impact Professional Section */}
                {status === AppStatus.REVIEWING_STRATEGY && strategy && (
                  <div className="w-full max-w-6xl mx-auto p-12 flex flex-col space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center space-x-3 bg-brand-600/10 text-brand-400 px-6 py-2 rounded-full text-xs font-black border border-brand-600/20 tracking-widest">
                        <Zap size={16} className="text-brand-500" />
                        <span>INTELLIGENCE REPORT READY</span>
                      </div>
                      <h2 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none">
                        SUCCESS <span className="text-brand-500">DNA</span> REPORT
                      </h2>
                      <p className="text-slate-400 font-bold max-w-2xl mx-auto text-lg leading-relaxed">
                        参考画像から「売れる理由」を完全に抽出しました。<br/>
                        この戦略に基づき、究極のファーストビューを構築します。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-[2.5rem] space-y-4 shadow-2xl backdrop-blur-sm group hover:border-brand-500/50 transition-colors">
                        <div className="flex items-center text-brand-500 font-black text-sm uppercase tracking-widest"><Target size={20} className="mr-3"/> Target Insight</div>
                        <textarea 
                          value={strategy.target} 
                          onChange={e => updateStrategyField('target', e.target.value)} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium focus:ring-1 ring-brand-500 outline-none h-48 resize-none text-slate-200" 
                        />
                      </div>
                      
                      <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-[2.5rem] space-y-4 shadow-2xl backdrop-blur-sm group hover:border-brand-500/50 transition-colors">
                        <div className="flex items-center text-brand-500 font-black text-sm uppercase tracking-widest"><Sparkles size={20} className="mr-3"/> Core Value DNA</div>
                        <textarea 
                          value={strategy.valueProp} 
                          onChange={e => updateStrategyField('valueProp', e.target.value)} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium focus:ring-1 ring-brand-500 outline-none h-48 resize-none text-slate-200" 
                        />
                      </div>

                      <div className="flex flex-col space-y-6">
                        <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-[2.5rem] flex-1 shadow-2xl backdrop-blur-sm">
                          <div className="flex items-center text-brand-500 font-black text-sm uppercase tracking-widest mb-4"><Palette size={20} className="mr-3"/> Psychology</div>
                          <div className="space-y-4">
                            <div className="p-3 bg-slate-950 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-tighter">Hierarchy</p>
                                <p className="text-xs text-slate-300 leading-relaxed font-medium line-clamp-2">{strategy.visualHierarchy}</p>
                            </div>
                            <div className="p-3 bg-slate-950 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-tighter">Colors</p>
                                <p className="text-xs text-slate-300 leading-relaxed font-medium line-clamp-2">{strategy.colorStrategy}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-brand-600 p-8 rounded-[2.5rem] shadow-2xl shadow-brand-500/20 flex flex-col justify-center text-white">
                           <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-70">Suggested Copy</p>
                           <input 
                            value={strategy.copySuggestion} 
                            onChange={e => updateStrategyField('copySuggestion', e.target.value)} 
                            className="w-full bg-brand-700/50 border border-white/20 rounded-xl p-4 text-lg font-black italic text-white outline-none focus:ring-2 ring-white/50 mb-6" 
                          />
                           <Button onClick={handleGenerateInitial} isLoading={(status as any) === AppStatus.GENERATING} className="w-full h-14 bg-white text-brand-600 hover:bg-slate-100 text-lg">
                              画像を生成する <ChevronRight className="ml-2" />
                           </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(status === AppStatus.ANALYZING || status === AppStatus.GENERATING) && (
                  <div className="text-center space-y-8 animate-in fade-in zoom-in">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 border-[6px] border-slate-800 rounded-full"></div>
                      <div className="absolute inset-0 border-[6px] border-brand-500 rounded-full border-t-transparent animate-spin"></div>
                      <Sparkles className="absolute inset-0 m-auto text-brand-500 animate-pulse" size={32} />
                    </div>
                    <h2 className="text-xl font-black italic text-white uppercase tracking-tighter">
                      {status === AppStatus.ANALYZING ? "Decoding Intent..." : "Rendering Strategic Pixels..."}
                    </h2>
                  </div>
                )}

                {resultImage && status !== AppStatus.REVIEWING_STRATEGY && (
                  <div className="w-full h-full flex items-center justify-center p-2 group relative">
                    <div 
                      className="max-w-full max-h-full shadow-2xl rounded-2xl overflow-hidden border-2 border-slate-800 transition-all relative"
                      style={{ 
                        aspectRatio: `${dimensions.width}/${dimensions.height}`,
                        width: dimensions.width >= dimensions.height ? '100%' : 'auto',
                        height: dimensions.height > dimensions.width ? '100%' : 'auto'
                      }}
                    >
                      <img 
                        src={`data:image/png;base64,${resultImage}`} 
                        className="w-full h-full object-contain bg-slate-950" 
                        alt="Design Output" 
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                         <button onClick={downloadImage} className="bg-brand-600 text-white p-4 rounded-full hover:scale-105 transition-all shadow-2xl">
                           <Download size={24} />
                         </button>
                         <button onClick={() => setIsMaximized(true)} className="bg-brand-600 text-white p-4 rounded-full hover:scale-105 transition-all shadow-2xl">
                           <Maximize2 size={24} />
                         </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input for Refinement */}
              {resultImage && status !== AppStatus.REVIEWING_STRATEGY && (
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 mt-auto">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-1.5 flex items-center shadow-2xl ring-1 ring-white/5">
                      <Sparkles className="ml-4 text-brand-500" size={18} />
                      <input 
                        type="text" 
                        className="flex-1 bg-transparent px-4 py-3 text-sm font-bold outline-none text-white placeholder:text-slate-600" 
                        placeholder="日本語で修正指示を入力して反映..."
                        value={adjustment}
                        onChange={(e) => setAdjustment(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <Button onClick={() => handleAdjust()} isLoading={status === AppStatus.GENERATING} className="rounded-xl px-6 h-10">
                        修正を実行
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="absolute bottom-6 right-6 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[10px] font-bold flex items-center space-x-2 animate-in slide-in-from-right shadow-2xl">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </main>
      </div>

      {/* Maximized Image Modal */}
      {isMaximized && resultImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center p-10 animate-in fade-in duration-300">
          <button onClick={() => setIsMaximized(false)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
            <X size={48} />
          </button>
          <div className="max-w-full max-h-full flex items-center justify-center overflow-hidden">
             <img src={`data:image/png;base64,${resultImage}`} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/5" alt="Maximized" />
          </div>
          <div className="mt-10">
            <Button onClick={downloadImage} className="px-12 py-5 rounded-2xl text-xl">
              <Download size={24} className="mr-3" /> 画像を保存する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
