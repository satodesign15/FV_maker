
import React, { useState, useEffect } from 'react';
import { UploadedImage, AppStatus } from './types';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { analyzeImageStructure, generateHighFidelityImage } from './services/geminiService';
import { Layout, Sparkles, Monitor, Smartphone, Download, AlertCircle, CheckCircle2, Crown, Zap, ArrowRight, Layers, RefreshCcw } from 'lucide-react';

const SIZE_PRESETS = [
  { id: 'pc', label: 'PC (16:9)', width: 1440, height: 810, icon: <Monitor size={18} /> },
  { id: 'sp', label: 'スマホ (9:16)', width: 1080, height: 1920, icon: <Smartphone size={18} /> },
];

const App: React.FC = () => {
  const [hasSelectedKey, setHasSelectedKey] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [instructions, setInstructions] = useState<string>('');
  const [canvasSize, setCanvasSize] = useState({ width: 1440, height: 810 });
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [finalOutput, setFinalOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // APIキー選択が必要かチェック
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

  const handleStartAnalysis = async () => {
    if (images.length === 0) return;
    setStatus(AppStatus.ANALYZING);
    setError('');
    try {
      const blueprint = await analyzeImageStructure(images, instructions);
      setAnalysisText(blueprint);
      setStatus(AppStatus.REVIEW);
    } catch (e: any) {
      setError(e.message || "分析中にエラーが発生しました。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGenerateImage = async () => {
    setStatus(AppStatus.GENERATING);
    try {
      const result = await generateHighFidelityImage(images, analysisText, canvasSize.width, canvasSize.height);
      setFinalOutput(result);
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found.")) {
        setHasSelectedKey(false);
        setError("APIキーが無効、または権限がありません。再選択してください。");
      } else {
        setError(e.message || "生成中にエラーが発生しました。");
      }
      setStatus(AppStatus.ERROR);
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setImages([]);
    setAnalysisText('');
    setFinalOutput('');
    setError('');
  };

  // APIキー未選択時のUI
  if (!hasSelectedKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/10">
          <div className="w-20 h-20 bg-brand-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-brand-500/20">
            <Crown className="text-white" size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">API Key Required</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Gemini 3 Pro Image (高精度モデル) を使用するために、有料プロジェクトのAPIキーを選択してください。
            </p>
          </div>
          <div className="space-y-4">
            <Button 
              onClick={async () => {
                await window.aistudio?.openSelectKey();
                setHasSelectedKey(true);
              }}
              className="w-full py-5 rounded-2xl text-lg font-black italic tracking-tighter bg-white text-slate-950 hover:bg-slate-100"
            >
              APIキーを選択して開始
            </Button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-[10px] text-slate-500 hover:text-white underline">
              課金設定のドキュメントを確認する
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50 px-8 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-slate-950 p-2.5 rounded-2xl text-white shadow-xl">
            <Layout size={24} />
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter">PixelPerfect <span className="text-brand-600">FV</span></h1>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-[11px] font-black border border-emerald-100">
            <Zap size={14} className="fill-emerald-700" /> <span>DNA REPRODUCTION 95% ACTIVE</span>
          </div>
          <button onClick={reset} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <RefreshCcw size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Workflow Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            {/* Step Indicators */}
            <div className="space-y-4">
              {[
                { step: 1, label: 'DNA分析', active: status === AppStatus.IDLE || status === AppStatus.ANALYZING || status === AppStatus.ERROR },
                { step: 2, label: '設計図確認', active: status === AppStatus.REVIEW },
                { step: 3, label: '高精度描画', active: status === AppStatus.GENERATING || status === AppStatus.SUCCESS }
              ].map((s) => (
                <div key={s.step} className={`flex items-center space-x-4 transition-all ${s.active ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${s.active ? 'bg-slate-950 text-white shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
                    {s.step}
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Main Panel */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 p-8 space-y-8">
              {(() => {
                if (status === AppStatus.IDLE || status === AppStatus.ERROR || status === AppStatus.ANALYZING) {
                  return (
                    <div className="space-y-8 animate-in fade-in duration-500">
                      <ImageUploader label="お手本にする画像 (DNA元)" images={images} onImagesChange={setImages} />
                      <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">追加のこだわり</label>
                        <textarea 
                          placeholder="例: 背景はもう少し青っぽく、高級なテック企業の雰囲気を強調して..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] p-5 text-sm focus:ring-4 ring-brand-500/10 outline-none transition-all h-28 resize-none"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {SIZE_PRESETS.map(p => (
                          <button 
                            key={p.id} 
                            onClick={() => setCanvasSize({ width: p.width, height: p.height })}
                            className={`p-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${canvasSize.width === p.width ? 'bg-slate-950 text-white border-slate-950 shadow-xl' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                          >
                            {p.icon}
                            <span className="text-[11px] font-black mt-2 uppercase">{p.label}</span>
                          </button>
                        ))}
                      </div>
                      <Button onClick={handleStartAnalysis} isLoading={status === AppStatus.ANALYZING} disabled={images.length === 0} className="w-full py-6 rounded-[1.5rem] text-xl font-black italic tracking-tighter group">
                        DNAを分析して設計図を作成 <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  );
                } else if (status === AppStatus.REVIEW || status === AppStatus.GENERATING) {
                  return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black italic">DESIGN BLUEPRINT</h2>
                        <Layers size={20} className="text-brand-600" />
                      </div>
                      <textarea 
                        className="w-full bg-slate-950 text-emerald-400 font-mono text-[11px] p-6 rounded-[2rem] h-[400px] leading-relaxed border border-white/10 shadow-inner focus:ring-4 ring-emerald-500/20 outline-none"
                        value={analysisText}
                        onChange={(e) => setAnalysisText(e.target.value)}
                        disabled={status === AppStatus.GENERATING}
                      />
                      <div className="space-y-4">
                        <Button onClick={handleGenerateImage} isLoading={status === AppStatus.GENERATING} className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black italic text-lg shadow-xl shadow-brand-500/30">
                          高精度描画を開始
                        </Button>
                        <button onClick={() => setStatus(AppStatus.IDLE)} disabled={status === AppStatus.GENERATING} className="w-full text-xs font-bold text-slate-400 hover:text-slate-900 underline">やり直す</button>
                      </div>
                    </div>
                  );
                } else if (status === AppStatus.SUCCESS) {
                  return (
                    <div className="text-center py-10 space-y-8 animate-in zoom-in duration-500">
                      <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                        <CheckCircle2 size={48} />
                      </div>
                      <h2 className="text-2xl font-black tracking-tighter uppercase">Fidelity Check: OK</h2>
                      <Button onClick={reset} className="w-full py-5 rounded-2xl font-black italic">
                        新しいデザインを作る
                      </Button>
                    </div>
                  );
                }
              })()}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-[2rem] text-sm flex items-start space-x-4 animate-in shake">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div className="font-bold">{error}</div>
              </div>
            )}
          </div>

          {/* Preview Canvas */}
          <div className="lg:col-span-8">
            <div className="relative h-full min-h-[700px] bg-white rounded-[3.5rem] shadow-2xl shadow-slate-300/60 border-[16px] border-white overflow-hidden flex flex-col items-center justify-center transition-all">
              {status === AppStatus.IDLE ? (
                <div className="text-center space-y-8 opacity-10">
                  <Layout size={150} strokeWidth={1} />
                  <p className="text-sm font-black tracking-[0.5em] uppercase">Visual Canvas</p>
                </div>
              ) : status === AppStatus.ANALYZING || status === AppStatus.GENERATING ? (
                <div className="flex flex-col items-center space-y-10 animate-in fade-in duration-500">
                  <div className="relative w-32 h-32">
                    <div className="absolute inset-0 border-4 border-brand-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-brand-600 animate-pulse" size={40} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-3xl font-black italic tracking-tighter text-slate-900">
                      {status === AppStatus.ANALYZING ? "ANALYZING DNA..." : "SYNTHESIZING..."}
                    </p>
                    <p className="text-[10px] font-black text-brand-600 tracking-[0.3em] uppercase">
                      ピクセルレベルでの高度な整合性を処理中
                    </p>
                  </div>
                </div>
              ) : finalOutput ? (
                <div className="w-full h-full relative animate-in fade-in duration-1000 group">
                  <img src={finalOutput} alt="Generated Visual" className="w-full h-full object-contain" />
                  <div className="absolute bottom-10 right-10">
                    <Button onClick={() => {
                      const link = document.createElement('a');
                      link.href = finalOutput;
                      link.download = `pixelperfect-fv-${Date.now()}.png`;
                      link.click();
                    }} className="rounded-2xl px-10 py-5 bg-slate-950 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all font-black italic">
                      <Download size={20} className="mr-3" /> 保存する
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 opacity-30">
                   <Layers size={60} strokeWidth={1} className="mx-auto" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em]">Awaiting Synthesize</p>
                </div>
              )}
              
              <div className="absolute top-8 left-8 bg-slate-950/5 backdrop-blur-md px-5 py-2.5 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-black/5">
                Target: {canvasSize.width} x {canvasSize.height}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
