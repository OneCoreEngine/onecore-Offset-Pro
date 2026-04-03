import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  FileCode, 
  Search, 
  Upload, 
  File, 
  Hash, 
  Info, 
  Download,
  Terminal,
  Cpu,
  Shield,
  Activity,
  ArrowRight,
  X,
  Copy,
  Layers,
  Box,
  Code2,
  Zap,
  Target,
  List,
  Type,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';
import { cn } from './lib/utils';
import { LIBRARY_SIGNATURES } from './constants/signatures';

interface AnalysisResult {
  fileName: string;
  foundOffsets: Record<string, string[]>;
  strings: { text: string; offset: number }[];
  version?: string;
  entropies?: Record<string, number>;
  recommendations?: string[];
  imports?: string[];
  prologues?: number[];
  callGraph?: { caller: number; callee: number }[];
  isPacked?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'strings' | 'imports' | 'calls' | 'diff' | 'info'>('scanner');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [allResults, setAllResults] = useState<Record<string, AnalysisResult>>({});
  const [selectedLib, setSelectedLib] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, data, message, progress: p } = e.data;
      
      if (type === 'progress') {
        setLoadingMessage(message);
        if (p !== undefined) setProgress(p);
      } else if (type === 'success') {
        setAllResults(prev => ({
          ...prev,
          [data.fileName]: data
        }));
        setSelectedLib(data.fileName);
        setLoading(false);
        toast.success(`${data.fileName} analysis complete!`);
      } else if (type === 'error') {
        toast.error(message);
        setLoading(false);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setLoading(true);
    setProgress(0);
    setLoadingMessage(`Initializing scan for ${file.name}...`);
    
    workerRef.current?.postMessage({ file });
  };

  const cancelScan = () => {
    workerRef.current?.postMessage({ action: 'cancel' });
    setLoading(false);
    toast.info('Scan cancelled');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const currentResult = selectedLib ? allResults[selectedLib] : null;

  return (
    <div className="min-h-screen matrix-bg text-text font-sans selection:bg-accent/30 overflow-x-hidden">
      <div className="scanline" />
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <header className="bg-surface/90 border-b border-border p-4 sticky top-0 z-[1000] backdrop-blur-md shadow-[0_0_20px_rgba(0,255,0,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-xl shadow-lg shadow-accent/40">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-accent uppercase drop-shadow-[0_0_12px_rgba(0,255,0,0.6)]">OneCore Bypass Maker</h1>
          </div>
          
          {selectedLib && (
            <div className="hidden md:flex items-center gap-2 bg-bg/80 px-4 py-2 rounded-full border border-accent/40 shadow-[0_0_15px_rgba(0,255,0,0.2)]">
              <FileCode className="w-4 h-4 text-accent" />
              <span className="text-xs font-black text-accent tracking-wider">{selectedLib}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 relative z-10">
        {/* Upload Zone */}
        {!loading && !currentResult && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "glass-panel p-12 flex flex-col items-center justify-center text-center space-y-6 transition-all border-2 border-dashed",
              isDragging ? "border-accent bg-accent/5" : "border-border"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="bg-accent/10 p-6 rounded-full">
              <Upload className="w-12 h-12 text-accent" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Drop .so files here</h2>
              <p className="text-muted">libUE4.so, libanogs.so, libTBlueData.so, libRoosterNN.so</p>
            </div>
            <input 
              id="file-input" 
              type="file" 
              className="hidden" 
              accept=".so" 
              onChange={(e) => handleFileUpload(e.target.files)} 
            />
            <button className="btn-primary">Select Library</button>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="glass-panel p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">{loadingMessage}</h3>
                <p className="text-xs text-muted uppercase tracking-widest">Processing Binary Data</p>
              </div>
              <span className="text-2xl font-black text-accent">{progress}%</span>
            </div>
            <div className="h-3 bg-bg rounded-full overflow-hidden border border-border">
              <motion.div 
                className="h-full bg-accent shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <button onClick={cancelScan} className="w-full btn-danger">Cancel Scan</button>
          </div>
        )}

        {/* Results Dashboard */}
        {currentResult && !loading && (
          <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
              {(['scanner', 'strings', 'imports', 'calls', 'diff', 'info'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-bold capitalize transition-all whitespace-nowrap border border-border",
                    activeTab === tab ? "tab-active" : "bg-surface text-muted hover:text-white"
                  )}
                >
                  {tab === 'calls' ? 'Call Graph' : tab === 'strings' ? 'Strings & XREF' : tab}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input 
                type="text"
                placeholder={`Search in ${activeTab}...`}
                className="w-full bg-surface border border-border rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-accent transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {activeTab === 'scanner' && currentResult && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* AOB Detections */}
                    {Object.entries(currentResult.foundOffsets).map(([name, offsets]) => (
                      <div key={name} className="glass-panel p-4 space-y-3 group">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-accent uppercase tracking-widest">{name}</span>
                          <Target className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                        </div>
                        <div className="space-y-2">
                          {(offsets as string[]).map((off, i) => (
                            <div key={i} className="flex items-center justify-between bg-bg/50 p-2 rounded-lg border border-accent/10">
                              <code className="text-sm font-mono text-accent">{off}</code>
                              <button onClick={() => copyToClipboard(off)} className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors">
                                <Copy className="w-4 h-4 text-accent/60" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Prologues */}
                    <div className="glass-panel p-4 space-y-3 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white uppercase tracking-widest">Function Prologues</span>
                        <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-black">
                          {currentResult.prologues?.length || 0} Found
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-2">
                        {currentResult.prologues?.slice(0, 500).map((off, i) => (
                          <button 
                            key={i} 
                            onClick={() => copyToClipboard(`0x${off.toString(16).toUpperCase()}`)}
                            className="text-[10px] font-mono bg-bg/50 border border-accent/10 p-1.5 rounded hover:border-accent transition-colors text-accent/70 hover:text-accent"
                          >
                            0x{off.toString(16).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'strings' && currentResult && (
                  <div className="glass-panel overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-bg/50">
                        <tr>
                          <th className="p-4 text-xs font-black text-accent uppercase tracking-widest">Offset</th>
                          <th className="p-4 text-xs font-black text-accent uppercase tracking-widest">String Content</th>
                          <th className="p-4 text-xs font-black text-accent uppercase tracking-widest">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent/5">
                        {currentResult.strings
                          .filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 200)
                          .map((s, i) => (
                            <tr key={i} className="hover:bg-accent/5 transition-colors">
                              <td className="p-4 font-mono text-xs text-accent">0x{s.offset.toString(16).toUpperCase()}</td>
                              <td className="p-4 text-sm text-white/90 break-all max-w-md">"{s.text}"</td>
                              <td className="p-4">
                                <button onClick={() => copyToClipboard(s.text)} className="p-2 hover:bg-accent/10 rounded-lg transition-colors">
                                  <Copy className="w-4 h-4 text-accent/60" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'imports' && currentResult && (
                  <div className="glass-panel overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 p-4">
                      {currentResult.imports
                        ?.filter(imp => imp.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((imp, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-bg/30 rounded border border-accent/10 hover:border-accent/40 transition-colors">
                            <span className="text-xs text-white/90 truncate pr-2">{imp}</span>
                            {['ptrace', 'fopen', 'pthread_create'].includes(imp) && (
                              <Shield className="w-3 h-3 text-error shrink-0" />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {activeTab === 'calls' && currentResult && (
                  <div className="glass-panel p-4 space-y-4">
                    <div className="flex items-center gap-2 text-accent">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Heuristic Call Graph (BL Instructions)</span>
                    </div>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                      {currentResult.callGraph
                        ?.slice(0, 500)
                        .map((call, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs font-mono p-2 bg-bg/50 rounded border border-accent/10">
                            <span className="text-accent">0x{call.caller.toString(16).toUpperCase()}</span>
                            <ArrowRight className="w-3 h-3 text-accent/40" />
                            <span className="text-white/90">0x{call.callee.toString(16).toUpperCase()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {activeTab === 'info' && currentResult && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Entropy Map */}
                    <div className="glass-panel p-6 space-y-4">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Section Entropy</h3>
                      <div className="space-y-3">
                        {Object.entries(currentResult.entropies || ({} as Record<string, number>)).map(([name, entropy]) => (
                          <div key={name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted font-bold">{name}</span>
                              <span className={cn("font-mono", (entropy as number) > 7.5 ? "text-error" : "text-success")}>
                                {(entropy as number).toFixed(2)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full", (entropy as number) > 7.5 ? "bg-error" : "bg-success")}
                                style={{ width: `${((entropy as number) / 8) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="glass-panel p-6 space-y-4">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Ban Fix Recommendations</h3>
                      <div className="space-y-3">
                        {(currentResult.recommendations || []).map((rec, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-bg/50 rounded-xl border border-border">
                            <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <p className="text-xs text-white leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'diff' && (
                  <div className="glass-panel p-12 text-center space-y-4">
                    <Layers className="w-12 h-12 text-muted mx-auto" />
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white">Compare Libraries</h3>
                      <p className="text-sm text-muted">Upload a second library to see offset changes between versions.</p>
                    </div>
                    <button className="btn-primary mx-auto" onClick={() => document.getElementById('file-input')?.click()}>
                      Upload Second .so
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto p-8 text-center border-t border-accent/10">
        <p className="text-xs font-black text-accent/50 uppercase tracking-[0.3em]">© 2026 OneCore Bypass Maker</p>
      </footer>
    </div>
  );
}
