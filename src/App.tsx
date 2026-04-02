import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  Github, 
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
  Settings,
  Layers,
  Palette,
  Box,
  Code2,
  PieChart,
  BarChart3,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ELFParser, ELFSymbol, ELFSection, ELFInfo, ELFSegment, ELFRelocation, ELFDynamicEntry } from './lib/elf';
import { cn } from './lib/utils';
import { demangle, isImportantSymbol, calculateEntropy } from './lib/binaryUtils';
import { HexViewModal } from './components/HexViewModal';
import { HelpModal } from './components/HelpModal';
import { EntropyChart } from './components/EntropyChart';
import { SectionMap } from './components/SectionMap';
import { SymbolsTable } from './components/SymbolsTable';
import { StringsView } from './components/StringsView';
import { SectionsView } from './components/SectionsView';
import { SegmentsView } from './components/SegmentsView';
import { RelocationsView } from './components/RelocationsView';
import { DynamicEntriesView } from './components/DynamicEntriesView';
import { BinaryInfoView } from './components/BinaryInfoView';
import { InspectorView } from './components/InspectorView';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [symbols, setSymbols] = useState<ELFSymbol[]>([]);
  const [strings, setStrings] = useState<string[]>([]);
  const [sections, setSections] = useState<ELFSection[]>([]);
  const [segments, setSegments] = useState<ELFSegment[]>([]);
  const [relocations, setRelocations] = useState<ELFRelocation[]>([]);
  const [dynamicEntries, setDynamicEntries] = useState<ELFDynamicEntry[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [entropyData, setEntropyData] = useState<{ offset: number; entropy: number }[]>([]);
  const [binaryInfo, setBinaryInfo] = useState<ELFInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'symbols' | 'strings' | 'sections' | 'segments' | 'relocations' | 'dynamic' | 'entropy' | 'info' | 'inspector'>('symbols');
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hexViewOffset, setHexViewOffset] = useState<number | null>(null);
  const [baseAddress, setBaseAddress] = useState<string>('0');
  const [theme, setTheme] = useState<'github-dark' | 'cyberpunk' | 'minimal-light'>('github-dark');
  const [sortBy, setSortBy] = useState<{ key: keyof ELFSymbol; direction: 'asc' | 'desc' }>({ key: 'value', direction: 'asc' });
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showHelp, setShowHelp] = useState(false);
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [showDemangled, setShowDemangled] = useState(true);
  const [controlsExpanded, setControlsExpanded] = useState(true);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleFile = useCallback(async (selectedFile: File) => {
    setLoading(true);
    setError(null);
    setFile(selectedFile);
    setFilePreview(null);

    const startTime = performance.now();

    try {
      const buffer = await selectedFile.arrayBuffer();
      setArrayBuffer(buffer);
      
      const previewBytes = new Uint8Array(buffer.slice(0, 8192));
      let previewText = '';
      for (let i = 0; i < previewBytes.length; i++) {
        const b = previewBytes[i];
        if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
          previewText += String.fromCharCode(b);
        } else {
          previewText += '·';
        }
      }
      setFilePreview(previewText);

      const parser = new ELFParser(buffer);
      
      const extractedSymbols = parser.getSymbols();
      const extractedStrings = parser.getStrings();
      const extractedSections = parser.getSections();
      const extractedSegments = parser.getSegments();
      const extractedRelocs = parser.getRelocations();
      const extractedDyn = parser.getDynamicEntries();
      const extractedDeps = parser.getDependencies();
      const info = parser.getBinaryInfo();
      
      const entropy = calculateEntropy(buffer);
      setEntropyData(entropy);
      
      setSymbols(extractedSymbols);
      setStrings(extractedStrings);
      setSections(extractedSections);
      setSegments(extractedSegments);
      setRelocations(extractedRelocs);
      setDynamicEntries(extractedDyn);
      setDependencies(extractedDeps);
      setBinaryInfo(info);
      
      const endTime = performance.now();
      setProcessingTime(Math.round(endTime - startTime));
      setActiveTab('symbols');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse ELF file');
      setSymbols([]);
      setStrings([]);
      setActiveTab('inspector');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Create a fake ELF buffer for demo purposes
      // 7f 45 4c 46 (ELF Magic)
      const demoBuffer = new Uint8Array(2048);
      demoBuffer.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      
      // We'll just mock the parser result for the demo to avoid complex buffer construction
      setFile({ name: 'demo_library.so', size: 2048, lastModified: Date.now() } as File);
      setArrayBuffer(demoBuffer.buffer);
      setBinaryInfo({
        class: 'ELF64',
        data: '2\'s complement, little endian',
        version: 1,
        osAbi: 'System V',
        type: 'Shared Object',
        machine: 'AArch64',
        entry: '0x1000'
      });
      setDependencies(['liblog.so', 'libc.so', 'libm.so', 'libdl.so']);
      setSymbols([
        { name: 'JNI_OnLoad', value: 0x1234, size: 128, type: 'FUNC', bind: 'GLOBAL', visibility: 'DEFAULT', sectionIndex: 1 },
        { name: 'Java_com_example_NativeLib_stringFromJNI', value: 0x5678, size: 256, type: 'FUNC', bind: 'GLOBAL', visibility: 'DEFAULT', sectionIndex: 1 },
        { name: 'secret_key', value: 0x9ABC, size: 32, type: 'OBJECT', bind: 'LOCAL', visibility: 'HIDDEN', sectionIndex: 2 },
        { name: '_start', value: 0x1000, size: 0, type: 'FUNC', bind: 'GLOBAL', visibility: 'DEFAULT', sectionIndex: 1 },
      ]);
      setStrings(['Hello from JNI!', 'libnative.so', '/data/local/tmp', 'com.example.app']);
      setSections([
        { name: '.text', type: 'PROGBITS', addr: 0x1000, offset: 0x1000, size: 0x2000, flags: 'AX' },
        { name: '.data', type: 'PROGBITS', addr: 0x3000, offset: 0x3000, size: 0x500, flags: 'WA' },
      ]);
      setProcessingTime(42);
      setActiveTab('symbols');
      setFilePreview('ELF Demo File Content...');
    } catch (err) {
      setError('Failed to load demo');
    } finally {
      setLoading(false);
    }
  }, []);

  const exportAsJson = useCallback(() => {
    if (symbols.length === 0 && strings.length === 0) return;
    
    const content = JSON.stringify({ symbols, sections, strings, binaryInfo, dependencies }, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name || 'analysis'}_offsets.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [symbols, sections, strings, binaryInfo, dependencies, file]);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const filteredSymbols = useMemo(() => {
    let filtered = symbols.filter(s => {
      const query = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(query) ||
        demangle(s.name).toLowerCase().includes(query) ||
        s.value.toString(16).toLowerCase().includes(query)
      );
    });

    if (filterType !== 'ALL') {
      filtered = filtered.filter(s => s.type === filterType);
    }

    filtered.sort((a, b) => {
      const aVal = a[sortBy.key];
      const bVal = b[sortBy.key];
      if (aVal < bVal) return sortBy.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortBy.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [symbols, searchQuery, filterType, sortBy]);

  const soname = useMemo(() => {
    return dynamicEntries.find(e => e.tag === 'SONAME')?.description || 'None';
  }, [dynamicEntries]);

  const filteredRelocations = useMemo(() => {
    return relocations.filter(r => {
      const query = searchQuery.toLowerCase();
      return (r.symbolName?.toLowerCase().includes(query) || 
              r.sectionName.toLowerCase().includes(query) ||
              r.offset.toString(16).toLowerCase().includes(query));
    });
  }, [relocations, searchQuery]);

  const filteredDynamic = useMemo(() => {
    return dynamicEntries.filter(e => {
      const query = searchQuery.toLowerCase();
      return (e.tag.toLowerCase().includes(query) || 
              e.description.toLowerCase().includes(query));
    });
  }, [dynamicEntries, searchQuery]);

  const baseAddrNum = useMemo(() => {
    try {
      return parseInt(baseAddress.replace('0x', ''), 16) || 0;
    } catch {
      return 0;
    }
  }, [baseAddress]);

  const hexViewData = useMemo(() => {
    if (!arrayBuffer || hexViewOffset === null) return null;
    const view = new Uint8Array(arrayBuffer);
    const start = Math.max(0, hexViewOffset);
    const end = Math.min(view.length, start + 256);
    const chunk = view.slice(start, end);
    return {
      offset: start,
      data: Array.from(chunk)
    };
  }, [arrayBuffer, hexViewOffset]);

  const filteredStrings = useMemo(() => {
    return strings.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [strings, searchQuery]);

  const stats = useMemo(() => {
    if (symbols.length === 0) return null;
    return {
      total: symbols.length,
      functions: symbols.filter(s => s.type === 'FUNC').length,
      objects: symbols.filter(s => s.type === 'OBJECT').length,
      global: symbols.filter(s => s.bind === 'GLOBAL').length,
    };
  }, [symbols]);

  const [hexGoToOffset, setHexGoToOffset] = useState<string>('');

  const exportReport = () => {
    const data = {
      binaryInfo,
      dependencies,
      symbols: symbols.map(s => ({ ...s, demangled: demangle(s.name) })),
      strings,
      sections,
      metadata: {
        fileName: file?.name,
        fileSize: file?.size,
        lastModified: file?.lastModified,
        processedAt: new Date().toISOString()
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name || 'binary'}_analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllOffsets = () => {
    if (filteredSymbols.length === 0) return;
    const text = filteredSymbols
      .map(s => `${s.name}: 0x${s.value.toString(16).toUpperCase()}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    alert('Copied all visible offsets to clipboard!');
  };

  const copyAsCppHeader = () => {
    if (filteredSymbols.length === 0) return;
    const header = filteredSymbols
      .filter(s => s.type === 'FUNC')
      .map(s => `// ${s.name}\n#define OFF_${s.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')} 0x${s.value.toString(16).toUpperCase()}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(header);
    alert('Copied C++ header to clipboard!');
  };

  return (
    <div className="min-h-screen bg-bg text-color font-sans selection:bg-accent-color/30">
      <HexViewModal 
        hexViewOffset={hexViewOffset} 
        setHexViewOffset={setHexViewOffset} 
        arrayBuffer={arrayBuffer} 
      />
      {/* GitHub Style Header */}
      <header className="bg-surface border-b border-color px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Github className="w-8 h-8 text-color" />
            <div className="flex items-center gap-1 text-sm font-semibold">
              <span className="text-accent-color hover:underline cursor-pointer">ravipacharpro</span>
              <span className="text-muted-color">/</span>
              <span className="text-accent-color hover:underline cursor-pointer">so-offset-explorer</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:relative sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-color" />
              <input 
                type="text"
                placeholder="Search..."
                className="bg-bg border border-color rounded-md pl-9 pr-3 py-1.5 text-sm w-48 lg:w-64 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-1 bg-bg border border-color rounded-md p-1">
              <button 
                onClick={() => setTheme('github-dark')}
                className={cn("p-1.5 rounded", theme === 'github-dark' && "bg-surface")}
                title="GitHub Dark"
              >
                <Github className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setTheme('cyberpunk')}
                className={cn("p-1.5 rounded", theme === 'cyberpunk' && "bg-surface")}
                title="Cyberpunk"
              >
                <Activity className="w-3.5 h-3.5 text-[#00ff00]" />
              </button>
              <button 
                onClick={() => setTheme('minimal-light')}
                className={cn("p-1.5 rounded", theme === 'minimal-light' && "bg-surface")}
                title="Minimal Light"
              >
                <Palette className="w-3.5 h-3.5 text-[#0969da]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
      <HelpModal 
        showHelp={showHelp} 
        setShowHelp={setShowHelp} 
      />

        {/* Mobile Search - Visible only on small screens */}
        <div className="sm:hidden mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-color" />
          <input 
            type="text"
            placeholder="Search symbols or offsets..."
            className="bg-surface border border-color rounded-md pl-9 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Repo Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-color/10 rounded-lg">
              <FileCode className="w-6 h-6 text-accent-color" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-color">OneCore Offset Finder</h1>
              <p className="text-sm text-muted-color">Extract and explore symbol offsets from Shared Object files with JNI support.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setFile(null);
                setSymbols([]);
                setStrings([]);
                setSections([]);
                setDependencies([]);
                setError(null);
                setFilePreview(null);
                setActiveTab('symbols');
              }}
              className="px-3 py-2 text-xs font-semibold text-muted-color hover:text-[#f85149] border border-color rounded-md transition-all"
            >
              Clear
            </button>
            <button 
              onClick={loadDemo}
              className="px-3 py-2 text-xs font-semibold text-muted-color hover:text-color border border-color rounded-md transition-all"
            >
              Try Demo
            </button>
            <button 
              onClick={() => document.getElementById('file-input')?.click()}
              className="bg-success-color hover:opacity-90 text-white rounded-md px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95 flex-1 md:flex-none justify-center"
            >
              <Upload className="w-4 h-4" />
              Upload .so
            </button>
            <input 
              id="file-input"
              type="file"
              accept=".so"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        </div>

        {/* Advanced Controls */}
        {symbols.length > 0 && (
          <div className="mb-6 bg-surface border border-color rounded-xl overflow-hidden">
            <button 
              onClick={() => setControlsExpanded(!controlsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-accent-color" />
                <span className="text-sm font-semibold text-color">Advanced Controls & Filters</span>
              </div>
              <ArrowRight className={cn("w-4 h-4 transition-transform", controlsExpanded ? "rotate-90" : "")} />
            </button>
            
            <AnimatePresence>
              {controlsExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 border-t border-color">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-color uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3 h-3" /> Base Address (Hex)
                      </label>
                      <input 
                        type="text"
                        placeholder="0x0"
                        className="bg-bg border border-color rounded-md px-3 py-1.5 text-xs w-full font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        value={baseAddress}
                        onChange={(e) => setBaseAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-color uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3 h-3" /> Filter Type
                      </label>
                      <select 
                        className="bg-bg border border-color rounded-md px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                      >
                        <option value="ALL">All Symbols</option>
                        <option value="FUNC">Functions Only</option>
                        <option value="OBJECT">Objects Only</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-color uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3 h-3" /> Sort By
                      </label>
                      <select 
                        className="bg-bg border border-color rounded-md px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        value={sortBy.key}
                        onChange={(e) => setSortBy({ ...sortBy, key: e.target.value as keyof ELFSymbol })}
                      >
                        <option value="value">Offset</option>
                        <option value="name">Name</option>
                        <option value="size">Size</option>
                        <option value="type">Type</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-color uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3 h-3" /> UI Mode
                      </label>
                      <button 
                        onClick={() => setBeginnerMode(!beginnerMode)}
                        className={cn(
                          "w-full px-3 py-1.5 text-xs rounded-md border transition-all flex items-center justify-center gap-2",
                          beginnerMode ? "bg-accent-color/10 border-accent-color text-accent-color" : "bg-bg border-color text-muted-color"
                        )}
                      >
                        {beginnerMode ? "Beginner Mode" : "Advanced Mode"}
                      </button>
                    </div>
                    <div className="flex items-end">
                      <div className="w-full p-2 bg-bg border border-color rounded-md flex items-center justify-between">
                        <span className="text-[10px] text-muted-color">Results</span>
                        <span className="text-xs font-mono font-bold text-accent-color">{filteredSymbols.length}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Stats */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface border border-color rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-color" />
                About
              </h3>
              <p className="text-xs text-muted-color leading-relaxed mb-4">
                This tool parses ELF headers to extract symbol tables from shared libraries. Useful for reverse engineering and debugging.
              </p>
              
              {stats && (
                <div className="space-y-3 pt-4 border-t border-color">
                  {processingTime && (
                    <div className="flex justify-between items-center text-xs mb-4 p-2 bg-success-color/5 border border-success-color/20 rounded">
                      <span className="text-muted-color flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Processed In
                      </span>
                      <span className="font-mono text-success-color font-bold">{processingTime}ms</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-color flex items-center gap-2">
                      <Hash className="w-3 h-3" /> Total Symbols
                    </span>
                    <span className="font-mono text-color">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-color flex items-center gap-2">
                      <Cpu className="w-3 h-3" /> Functions
                    </span>
                    <span className="font-mono text-color">{stats.functions}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-color flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Objects
                    </span>
                    <span className="font-mono text-color">{stats.objects}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-color flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Global
                    </span>
                    <span className="font-mono text-color">{stats.global}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface border border-color rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Languages</h3>
              <div className="space-y-2">
                <div className="h-2 w-full bg-bg rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#f34b7d]" style={{ width: '70%' }}></div>
                  <div className="h-full bg-[#3572A5]" style={{ width: '20%' }}></div>
                  <div className="h-full bg-[#f1e05a]" style={{ width: '10%' }}></div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-[#f34b7d]"></div>
                    <span className="text-color">C++</span>
                    <span className="text-muted-color">70.0%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-[#3572A5]"></div>
                    <span className="text-color">C</span>
                    <span className="text-muted-color">20.0%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-[#f1e05a]"></div>
                    <span className="text-color">Assembly</span>
                    <span className="text-muted-color">10.0%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Drop Zone / File Info */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 group",
                isDragging ? "border-accent-color bg-accent-color/5" : "border-color bg-surface",
                !file && "cursor-pointer hover:border-muted-color"
              )}
              onClick={() => !file && document.getElementById('file-input')?.click()}
            >
              <AnimatePresence mode="wait">
                {!file ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <File className="w-8 h-8 text-muted-color" />
                    </div>
                    <h4 className="text-lg font-semibold text-color mb-2">Drop your .so file here</h4>
                    <p className="text-sm text-muted-color max-w-xs">
                      Drag and drop or click to select a shared library file to analyze.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="file"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-accent-color/20 rounded-lg flex items-center justify-center">
                        <FileCode className="w-6 h-6 text-accent-color" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-color">{file.name}</h4>
                        <p className="text-xs text-muted-color">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • Last modified {new Date(file.lastModified).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); setSymbols([]); }}
                      className="p-2 hover:bg-bg rounded-md transition-colors"
                    >
                      <X className="w-5 h-5 text-muted-color" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className={cn(
                "rounded-md p-4 flex flex-col gap-3 transition-all",
                error.includes("text file") || error.includes("linker script") 
                  ? "bg-accent-color/10 border border-accent-color/40 text-accent-color" 
                  : "bg-[#f85149]/10 border border-[#f85149]/40 text-[#f85149]"
              )}>
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
                
                {(error.includes("text file") || error.includes("linker script")) && (
                  <div className="pl-8 space-y-2 text-xs opacity-90 leading-relaxed">
                    <p className="font-bold border-b border-accent-color/20 pb-1 mb-2">Why am I seeing this?</p>
                    <p>In some Android build environments (like CMake or NDK), the <code className="bg-bg/50 px-1 rounded">.so</code> files in certain directories are actually small text files called "Linker Scripts" that point to the real binary.</p>
                    <p className="font-bold mt-2">How to fix:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Check your <code className="bg-bg/50 px-1 rounded">obj/local/</code> or <code className="bg-bg/50 px-1 rounded">libs/</code> subdirectories.</li>
                      <li>Look for a much larger file (usually several MBs) with the same name.</li>
                      <li>Ensure you are not uploading a <code className="bg-bg/50 px-1 rounded">.cpp</code>, <code className="bg-bg/50 px-1 rounded">.h</code>, or <code className="bg-bg/50 px-1 rounded">.txt</code> file.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Symbols Table */}
            <div className="bg-surface border border-color rounded-xl overflow-hidden shadow-sm">
              <div className="bg-surface border-b border-color px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                  <button 
                    onClick={() => setActiveTab('symbols')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'symbols' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Symbols</span>
                    <span className="bg-bg border border-color text-muted-color px-1.5 rounded-full text-[10px]">
                      {symbols.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('strings')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'strings' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Strings</span>
                    <span className="bg-bg border border-color text-muted-color px-1.5 rounded-full text-[10px]">
                      {strings.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('sections')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'sections' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sections</span>
                    <span className="bg-bg border border-color text-muted-color px-1.5 rounded-full text-[10px]">
                      {sections.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('segments')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'segments' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Segments</span>
                    <span className="bg-bg border border-color text-muted-color px-1.5 rounded-full text-[10px]">
                      {segments.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('relocations')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'relocations' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Relocs</span>
                    <span className="bg-bg border border-color text-muted-color px-1.5 rounded-full text-[10px]">
                      {relocations.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('dynamic')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'dynamic' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Dynamic</span>
                    <span className="bg-bg border border-color text-muted-color px-1.5 rounded-full text-[10px]">
                      {dynamicEntries.length}
                    </span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('entropy')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'entropy' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Entropy</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('info')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'info' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Info</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('inspector')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      activeTab === 'inspector' ? "bg-bg border border-color text-color shadow-sm" : "text-muted-color hover:text-color"
                    )}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Inspector</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowDemangled(!showDemangled)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                      showDemangled ? "bg-primary-color/10 text-primary-color border border-primary-color/20" : "bg-surface text-muted-color border border-color"
                    )}
                    title="Toggle C++ Demangling"
                  >
                    <Code2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Demangle</span>
                  </button>
                  <div className="h-4 w-px bg-color/10 mx-1"></div>
                  <button 
                    onClick={() => copyAsCppHeader()}
                    disabled={symbols.length === 0}
                    className="p-1.5 hover:bg-bg rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy as C++ Header"
                  >
                    <FileCode className="w-4 h-4 text-accent-color" />
                  </button>
                  <button 
                    onClick={() => exportAsJson()}
                    disabled={symbols.length === 0 && strings.length === 0}
                    className="p-1.5 hover:bg-bg rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export as JSON"
                  >
                    <Download className="w-4 h-4 text-success-color" />
                  </button>
                  <button 
                    onClick={() => copyAllOffsets()}
                    disabled={symbols.length === 0}
                    className="p-1.5 hover:bg-bg rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy All Offsets"
                  >
                    <Copy className="w-4 h-4 text-muted-color" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {activeTab === 'symbols' ? (
                  <SymbolsTable 
                    symbols={symbols}
                    filteredSymbols={filteredSymbols}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    filterType={filterType}
                    setFilterType={setFilterType}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    baseAddress={baseAddress}
                    setBaseAddress={setBaseAddress}
                    setHexViewOffset={setHexViewOffset}
                    copyAllOffsets={copyAllOffsets}
                    copyAsCppHeader={copyAsCppHeader}
                  />
                ) : activeTab === 'strings' ? (
                  <StringsView 
                    strings={strings}
                    searchQuery={searchQuery}
                  />
                ) : activeTab === 'sections' ? (
                  <SectionsView 
                    sections={sections}
                    fileSize={file?.size || 0}
                  />
                ) : activeTab === 'segments' ? (
                  <SegmentsView 
                    segments={segments}
                  />
                ) : activeTab === 'relocations' ? (
                  <RelocationsView 
                    relocations={relocations}
                  />
                ) : activeTab === 'dynamic' ? (
                  <DynamicEntriesView 
                    dynamicEntries={dynamicEntries}
                  />
                ) : activeTab === 'entropy' ? (
                  <div className="p-6 bg-bg h-full overflow-auto">
                    <EntropyChart data={entropyData} />
                  </div>
                ) : activeTab === 'info' ? (
                  <BinaryInfoView 
                    binaryInfo={binaryInfo}
                    file={file}
                    soname={soname}
                    symbols={symbols}
                    strings={strings}
                    dependencies={dependencies}
                    sections={sections}
                  />
                ) : (
                  <InspectorView 
                    filePreview={filePreview}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-[#30363d] mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-[#8b949e] text-xs">
            <Github className="w-5 h-5" />
            <span>© 2026 SO Offset Explorer. Built with React & Tailwind.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#8b949e]">
            <a href="#" className="hover:text-[#58a6ff]">Terms</a>
            <a href="#" className="hover:text-[#58a6ff]">Privacy</a>
            <a href="#" className="hover:text-[#58a6ff]">Docs</a>
            <a href="#" className="hover:text-[#58a6ff]">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
