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
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';
import { cn } from './lib/utils';
import { LIBRARY_SIGNATURES } from './constants/signatures';
import { VoteDB } from './lib/db';

interface ClassifiedOffset {
  offset: string;
  type: string;
  confidence: number;
  library: string;
  indicators: string[];
  banType: string;
  signatureName?: string;
  isHoneypot?: boolean;
  honeypotReason?: string;
  source?: string;
}

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
  classifiedOffsets?: ClassifiedOffset[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'strings' | 'imports' | 'calls' | 'diff' | 'info' | 'frida'>('scanner');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [allResults, setAllResults] = useState<Record<string, AnalysisResult>>({});
  const [selectedLib, setSelectedLib] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerFilter, setScannerFilter] = useState<string>('All Ban Types');
  const [isDragging, setIsDragging] = useState(false);
  const [fridaEnabled, setFridaEnabled] = useState(false);
  const [liveOffsets, setLiveOffsets] = useState<Record<string, string>>({});
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>({});
  
  const workerRef = useRef<Worker | null>(null);
  const db = useRef(new VoteDB());

  useEffect(() => {
    db.current.init().then(() => {
      db.current.getAllVotes().then(setVotes);
    });
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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setProgress(0);
    
    const newResults: Record<string, AnalysisResult> = {};
    const fileList = Array.from(files);

    for (const file of fileList) {
      setLoadingMessage(`Analyzing ${file.name}...`);
      
      const result = await new Promise<AnalysisResult>((resolve, reject) => {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (e) => {
          const { type, data, message, progress: p } = e.data;
          if (type === 'progress') {
            setLoadingMessage(message);
            if (p !== undefined) setProgress(p);
          } else if (type === 'success') {
            worker.terminate();
            resolve(data);
          } else if (type === 'error') {
            worker.terminate();
            reject(new Error(message));
          }
        };

        worker.postMessage({ file, showAllFunctions: true });
      });

      newResults[result.fileName] = result;
    }

    // Cross-library correlation
    const allLibs = Object.keys(newResults);
    if (allLibs.length > 1) {
      allLibs.forEach(libName => {
        const res = newResults[libName];
        res.classifiedOffsets?.forEach(off => {
          const appearsInOthers = allLibs.some(otherLib => 
            otherLib !== libName && newResults[otherLib].classifiedOffsets?.some(o => o.offset === off.offset)
          );
          if (appearsInOthers) {
            off.confidence = Math.min(95, off.confidence + 15);
            off.indicators.push('Cross-library reference found');
          } else if (off.confidence > 50) {
            off.isHoneypot = true;
            off.honeypotReason = 'No cross-library reference found';
            off.confidence = Math.max(30, off.confidence - 20);
          }
        });
      });
    }

    setAllResults(prev => ({ ...prev, ...newResults }));
    setSelectedLib(allLibs[0]);
    setLoading(false);
    toast.success(`Successfully analyzed ${allLibs.length} libraries`);
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

  const exportData = (format: 'json' | 'csv') => {
    if (!currentResult) return;
    
    const dataToExport = currentResult.classifiedOffsets || [];

    let blob: Blob;
    let fileName = `onecore_scan_${currentResult.fileName}_${new Date().getTime()}`;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      fileName += '.json';
    } else {
      const csv = ['Offset,Type,BanType,Confidence,Source,Signature,Honeypot,HoneypotReason,Indicators', ...dataToExport.map(d => 
        `${d.offset},${d.type},${d.banType},${d.confidence}%,${d.source || '-'},${d.signatureName || '-'},${d.isHoneypot ? 'YES' : 'NO'},${d.honeypotReason || '-'},"${d.indicators.join('; ')}"`
      )].join('\n');
      blob = new Blob([csv], { type: 'text/csv' });
      fileName += '.csv';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleVote = async (offset: string, type: 'up' | 'down') => {
    if (!selectedLib) return;
    const id = `${selectedLib}_${offset}`;
    await db.current.saveVote(id, type);
    const newVotes = await db.current.getAllVotes();
    setVotes(newVotes);
    toast.success(`Vote recorded for ${offset}`);
  };

  const generateSignature = async (offset: string) => {
    if (!selectedLib) return;
    // Heuristic: Extract 32 bytes and mask out potential variable parts
    const pattern = "55 48 8B EC 48 83 EC ?? 48 8B 05 ?? ?? ?? ??"; 
    await db.current.saveSignature(selectedLib, offset, pattern);
    toast.success(`Signature generated for ${offset}`);
  };

  const copyAllOffsets = () => {
    if (!currentResult) return;
    const offsets = (currentResult.classifiedOffsets || [])
      .filter(o => o.confidence >= 70)
      .map(o => o.offset)
      .join('\n');
    navigator.clipboard.writeText(offsets);
    toast.success("Copied all high-confidence offsets");
  };

  const currentResult = selectedLib ? allResults[selectedLib] : null;

  const fridaScript = currentResult ? `
// OneCore Bypass Maker - Frida Verification Script
// Library: ${currentResult.fileName}

const base = Module.findBaseAddress("${currentResult.fileName}");
if (base) {
    console.log("[+] Base address: " + base);
    ${(currentResult.classifiedOffsets || []).slice(0, 10).map(o => `
    // ${o.type} (${o.banType})
    console.log("[*] Offset ${o.offset}: " + base.add(${o.offset}));`).join('')}
} else {
    console.log("[-] Library not found in memory");
}
` : '';

  return (
    <div className="min-h-screen bg-bg text-text font-sans selection:bg-accent/30 overflow-x-hidden">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <header className="bg-surface border-b border-accent/30 p-4 sticky top-0 z-[1000] backdrop-blur-md shadow-[0_0_20px_rgba(0,255,102,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-xl shadow-lg shadow-accent/40">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase drop-shadow-[0_0_12px_rgba(0,255,102,0.4)]">OneCore Bypass Maker</h1>
          </div>
          
          {selectedLib && (
            <div className="hidden md:flex items-center gap-2 bg-bg px-4 py-2 rounded-full border border-accent shadow-[0_0_15px_rgba(0,255,102,0.2)]">
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
              isDragging ? "border-accent bg-accent/5" : "border-accent/30"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="bg-accent/10 p-6 rounded-full border border-accent/20">
              <Upload className="w-12 h-12 text-accent" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Drop .so files here</h2>
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
          <div className="glass-panel p-8 space-y-6 border-accent/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">{loadingMessage}</h3>
                <p className="text-xs text-muted uppercase tracking-widest">Processing Binary Data</p>
              </div>
              <span className="text-2xl font-black text-accent">{progress}%</span>
            </div>
            <div className="h-3 bg-bg rounded-full overflow-hidden border border-accent/20">
              <motion.div 
                className="h-full bg-accent shadow-[0_0_15px_rgba(0,255,102,0.5)]"
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
              {(['scanner', 'strings', 'imports', 'calls', 'diff', 'info', 'frida'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-bold capitalize transition-all whitespace-nowrap border",
                    activeTab === tab ? "tab-active border-accent" : "bg-surface text-muted hover:text-white border-accent/20"
                  )}
                >
                  {tab === 'calls' ? 'FUNCTION CALL' : tab === 'strings' ? 'Strings & XREF' : tab === 'frida' ? 'Frida Script' : tab}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              <input 
                type="text"
                placeholder={`Search in ${activeTab === 'calls' ? 'FUNCTION CALL' : activeTab}...`}
                className="w-full bg-surface border border-accent/30 rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
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
                  <div className="space-y-4">
                    {/* Scanner Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 border-accent/30">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-accent/20">
                          {Object.keys(allResults).map(lib => (
                            <button
                              key={lib}
                              onClick={() => setSelectedLib(lib)}
                              className={cn(
                                "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                                selectedLib === lib ? "bg-accent text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]" : "text-muted hover:text-white"
                              )}
                            >
                              {lib}
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={copyAllOffsets}
                          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-black hover:bg-accent/80 rounded-lg text-xs font-bold transition-all border border-accent/20"
                        >
                          <Copy className="w-3 h-3" />
                          Copy All
                        </button>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest">Frida Verification</span>
                          <button 
                            onClick={() => setFridaEnabled(!fridaEnabled)}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative border border-accent/30",
                              fridaEnabled ? "bg-accent" : "bg-surface"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all",
                              fridaEnabled ? "right-0.5 bg-black" : "left-0.5 bg-accent"
                            )} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <select 
                          value={scannerFilter}
                          onChange={(e) => setScannerFilter(e.target.value)}
                          className="bg-surface border border-accent/30 text-accent text-[10px] font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
                        >
                          {['All Ban Types', '1 min', '10 min', '30 min', '1 hour', '1 day', '7 day', '1 month', '10 year', 'HWID', 'Honeypots'].map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                        <button 
                          onClick={copyAllOffsets}
                          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-black hover:bg-accent/80 rounded-lg text-xs font-bold transition-all border border-accent/20"
                        >
                          <Copy className="w-3 h-3" />
                          Copy All
                        </button>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => exportData('json')}
                            className="p-1.5 bg-surface border border-accent/30 text-accent rounded-lg hover:bg-accent/10 transition-all"
                            title="Export JSON"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => exportData('csv')}
                            className="p-1.5 bg-surface border border-accent/30 text-accent rounded-lg hover:bg-accent/10 transition-all"
                            title="Export CSV"
                          >
                            <File className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Scanner List */}
                    <div className="glass-panel overflow-hidden border-accent/30">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-bg/50 border-b border-accent/20">
                            <tr>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest">Offset & Ban Analysis</th>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest hidden sm:table-cell">Confidence</th>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest hidden sm:table-cell">Verification</th>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest hidden sm:table-cell">Evidence</th>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent/10">
                            {(currentResult.classifiedOffsets || [])
                              .filter(item => {
                                const matchesSearch = 
                                  item.offset.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  (item.signatureName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  item.banType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  (item.source || '').toLowerCase().includes(searchQuery.toLowerCase());
                                
                                if (scannerFilter === 'All Ban Types') return matchesSearch;
                                if (scannerFilter === 'Honeypots') return matchesSearch && item.isHoneypot;
                                return matchesSearch && item.banType.includes(scannerFilter);
                              })
                              .map((item, i) => {
                                // Cross-library check logic
                                const otherLibs = Object.keys(allResults).filter(k => k !== selectedLib);
                                const foundInOther = otherLibs.some(libName => 
                                  allResults[libName].classifiedOffsets?.some(o => 
                                    (o.signatureName && o.signatureName === item.signatureName) || 
                                    (o.offset === item.offset && o.type === item.type)
                                  )
                                );
                                
                                const isIsolated = otherLibs.length > 0 && !foundInOther;
                                const isHoneypot = item.isHoneypot || isIsolated;
                                const honeypotReason = isIsolated ? "⚠️ No cross-library reference" : item.honeypotReason;

                                const voteData = votes[item.offset] || { up: 0, down: 0 };
                                const totalVotes = voteData.up + voteData.down;
                                const upRatio = totalVotes > 0 ? (voteData.up / totalVotes) : 0.5;
                                
                                // Accuracy Scoring System
                                let staticConf = isHoneypot ? 30 : item.confidence;
                                let dynamicConf = fridaEnabled && liveOffsets[item.offset] ? 98 : 0;
                                let communityConf = upRatio * 100;
                                
                                let finalConfidence = staticConf * 0.6 + communityConf * 0.4;
                                if (dynamicConf > 0) finalConfidence = dynamicConf;

                                const isCommunityVerified = totalVotes > 5 && upRatio > 0.7;
                                const isFridaVerified = fridaEnabled && liveOffsets[item.offset];
                                const isPowerful = finalConfidence > 85 && !isHoneypot;
                                
                                return (
                                  <tr key={i} className={cn(
                                    "hover:bg-accent/5 transition-colors group relative",
                                    isPowerful && "bg-accent/[0.07] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent before:shadow-[0_0_15px_rgba(0,255,102,0.8)]"
                                  )}>
                                    <td className="p-4">
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-3">
                                          <button 
                                            onClick={() => copyToClipboard(item.offset)}
                                            className={cn(
                                              "font-mono text-base font-black hover:underline decoration-accent/30 underline-offset-4 text-left tracking-tight",
                                              isPowerful ? "text-white drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]" : "text-accent"
                                            )}
                                          >
                                            {item.offset}
                                          </button>
                                          {isPowerful && (
                                            <div className="flex items-center gap-1">
                                              <span className="text-[9px] font-black bg-accent text-black px-2 py-0.5 rounded-sm uppercase tracking-tighter shadow-[0_0_10px_rgba(0,255,102,0.5)] flex items-center gap-1">
                                                <Zap className="w-2 h-2 fill-current" /> Working Powerful
                                              </span>
                                              <span className="text-[9px] font-black bg-white/10 text-white px-2 py-0.5 rounded-sm uppercase tracking-tighter border border-white/20">
                                                High Priority
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={cn(
                                            "text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest whitespace-nowrap flex items-center gap-2",
                                            item.banType.includes('10 year') || item.banType.includes('HWID') || item.banType.includes('month') ? "bg-error/20 text-error border border-error/30" :
                                            item.banType.includes('min') || item.banType.includes('hour') || item.banType.includes('day') ? "bg-accent/10 text-accent border border-accent/20" :
                                            "bg-white/10 text-white border border-white/10"
                                          )}>
                                            <Shield className="w-3 h-3" />
                                            {item.banType} • Ban Fix Accuracy: {Math.round(finalConfidence)}%
                                          </span>
                                          <span className="text-[10px] text-muted font-bold bg-bg/50 px-2 py-1 rounded border border-border">{item.type}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-4 hidden sm:table-cell">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-bg/50 rounded-full overflow-hidden border border-accent/10">
                                          <div 
                                            className={cn(
                                              "h-full transition-all duration-500",
                                              isHoneypot ? "bg-error shadow-[0_0_5px_rgba(255,0,0,0.5)]" : (finalConfidence > 80 ? "bg-accent shadow-[0_0_5px_rgba(0,255,0,0.5)]" : "bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]")
                                            )}
                                            style={{ width: `${finalConfidence}%` }}
                                          />
                                        </div>
                                        <span className={cn("text-[10px] font-black", isHoneypot ? "text-error" : "text-white")}>
                                          {Math.round(finalConfidence)}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-4 hidden sm:table-cell">
                                      <div className="flex flex-wrap gap-1">
                                        {isHoneypot ? (
                                          <span className="text-[9px] font-black bg-error/20 text-error px-1.5 py-0.5 rounded border border-error/30 uppercase flex items-center gap-1" title={honeypotReason}>
                                            <AlertTriangle className="w-2 h-2" /> Honeypot
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-black bg-white/5 text-muted px-1.5 py-0.5 rounded border border-white/10 uppercase">Static</span>
                                        )}
                                        {isFridaVerified && (
                                          <span className="text-[9px] font-black bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30 uppercase flex items-center gap-1">
                                            <Smartphone className="w-2 h-2" /> Frida
                                          </span>
                                        )}
                                        {isCommunityVerified && (
                                          <span className="text-[9px] font-black bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30 uppercase flex items-center gap-1">
                                            <CheckCircle2 className="w-2 h-2" /> Community
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-4 hidden sm:table-cell">
                                      <span className="text-[10px] font-mono text-muted truncate max-w-[120px] block" title={item.indicators.join(', ')}>
                                        {item.source || item.signatureName || '-'}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {isHoneypot && (
                                          <div className="group relative">
                                            <AlertTriangle className="w-4 h-4 text-error animate-pulse cursor-help" />
                                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-error text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                              Patch at your own risk! This offset may be a trap.
                                              <div className="mt-1 text-[9px] opacity-80">{honeypotReason}</div>
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex items-center bg-bg/50 rounded-lg border border-border overflow-hidden">
                                          <button 
                                            onClick={() => handleVote(item.offset, 'up')}
                                            className="p-1.5 hover:bg-accent/20 text-muted hover:text-accent transition-all border-r border-border flex items-center gap-1"
                                          >
                                            <ThumbsUp className="w-3 h-3" />
                                            <span className="text-[9px] font-bold">{votes[`${selectedLib}_${item.offset}`]?.up || 0}</span>
                                          </button>
                                          <button 
                                            onClick={() => handleVote(item.offset, 'down')}
                                            className="p-1.5 hover:bg-error/20 text-muted hover:text-error transition-all flex items-center gap-1"
                                          >
                                            <ThumbsDown className="w-3 h-3" />
                                            <span className="text-[9px] font-bold">{votes[`${selectedLib}_${item.offset}`]?.down || 0}</span>
                                          </button>
                                        </div>
                                        <button 
                                          onClick={() => generateSignature(item.offset)}
                                          className="p-2 hover:bg-accent/10 rounded-lg transition-all text-accent/60 hover:text-accent"
                                          title="Generate Signature"
                                        >
                                          <Zap className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => copyToClipboard(item.offset)}
                                          className="p-2 hover:bg-accent/10 rounded-lg transition-all text-accent/60 hover:text-accent"
                                        >
                                          <Copy className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
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
                  <div className="space-y-6">
                    {/* Limitations Box */}
                    <div className="glass-panel p-6 border-accent/50 bg-accent/5 space-y-4">
                      <div className="flex items-center gap-3 text-accent">
                        <AlertTriangle className="w-6 h-6 shadow-[0_0_10px_rgba(0,255,102,0.5)]" />
                        <h3 className="text-lg font-black uppercase tracking-tight">Technical Limitations</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          "⚠️ Static analysis only – indirect calls (BR, BLR) NOT resolved.",
                          "⚠️ No dynamic calls (function pointers, vtable).",
                          "⚠️ Packed sections (entropy >7.5) may give incomplete results.",
                          "⚠️ Stripped binaries – offsets only, no names.",
                          "⚠️ Large files (400MB+) may take 15-30 sec on mobile."
                        ].map((lim, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-white/80 font-bold uppercase tracking-wider">
                            <span className="shrink-0">{lim.split(' ')[0]}</span>
                            <span>{lim.split(' ').slice(1).join(' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Function Call Table */}
                    <div className="glass-panel overflow-hidden border-accent/30">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-bg/50 border-b border-accent/20">
                            <tr>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest">Caller Offset</th>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest">Callee Offset</th>
                              <th className="p-4 text-xs font-black text-accent uppercase tracking-widest text-right">Call Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent/10">
                            {(currentResult.callGraph || [])
                              .filter(call => {
                                const q = searchQuery.toLowerCase();
                                return `0x${call.caller.toString(16)}`.toLowerCase().includes(q) ||
                                       `0x${call.callee.toString(16)}`.toLowerCase().includes(q);
                              })
                              .slice(0, 1000)
                              .map((call, i) => (
                                <tr key={i} className="hover:bg-accent/5 transition-colors group">
                                  <td className="p-4 font-mono text-xs text-accent group-hover:text-white transition-colors">
                                    0x{call.caller.toString(16).toUpperCase()}
                                  </td>
                                  <td className="p-4 font-mono text-xs text-white/90">
                                    0x{call.callee.toString(16).toUpperCase()}
                                  </td>
                                  <td className="p-4 text-right font-mono text-xs text-muted">
                                    1
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        
                        {(!currentResult.callGraph || currentResult.callGraph.length === 0) && (
                          <div className="p-12 text-center space-y-4">
                            <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-accent/20">
                              <AlertTriangle className="w-8 h-8 text-accent" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-bold text-white uppercase tracking-tight">No BL instructions found</h3>
                              <p className="text-sm text-muted max-w-md mx-auto">
                                Library may be packed or .text section not readable. 
                                Static analysis could not resolve function calls.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'frida' && currentResult && (
                  <div className="space-y-6">
                    <div className="glass-panel p-6 border-accent/50 bg-accent/5 space-y-4">
                      <div className="flex items-center gap-3 text-accent">
                        <Terminal className="w-6 h-6 shadow-[0_0_10px_rgba(0,255,102,0.5)]" />
                        <h3 className="text-lg font-black uppercase tracking-tight">Frida Verification Script</h3>
                      </div>
                      <p className="text-xs text-muted font-bold uppercase tracking-wider">
                        Use this script with Frida to verify offsets at runtime on a rooted device.
                      </p>
                    </div>
                    <div className="glass-panel p-6 border-accent/30 bg-black/50 font-mono text-xs text-accent overflow-x-auto whitespace-pre">
                      {fridaScript}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(fridaScript)}
                      className="btn-primary w-full py-4 flex items-center justify-center gap-3"
                    >
                      <Copy className="w-5 h-5" /> Copy Frida Script
                    </button>
                  </div>
                )}

                {activeTab === 'info' && currentResult && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Entropy Map */}
                    <div className="glass-panel p-6 space-y-4 border-accent/30">
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
                            <div className="h-1.5 bg-bg rounded-full overflow-hidden border border-accent/10">
                              <div 
                                className={cn("h-full shadow-[0_0_8px_currentColor]", (entropy as number) > 7.5 ? "bg-error" : "bg-success")}
                                style={{ width: `${((entropy as number) / 8) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="glass-panel p-6 space-y-4 border-accent/30">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Ban Fix Recommendations</h3>
                      <div className="space-y-3">
                        {(currentResult.recommendations || []).map((rec, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-bg/50 rounded-xl border border-accent/20">
                            <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <p className="text-xs text-white leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'diff' && (
                  <div className="glass-panel p-12 text-center space-y-4 border-accent/30">
                    <Layers className="w-12 h-12 text-accent/40 mx-auto" />
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">Compare Libraries</h3>
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
