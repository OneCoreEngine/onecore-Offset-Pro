import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, X, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface HexViewModalProps {
  offset: number;
  onClose: () => void;
  readBuffer: (offset: number, size: number) => Promise<ArrayBuffer | null>;
}

export const HexViewModal: React.FC<HexViewModalProps> = ({ 
  offset: initialOffset, 
  onClose, 
  readBuffer 
}) => {
  const [currentOffset, setCurrentOffset] = useState(initialOffset);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingByte, setEditingByte] = useState<{ index: number; value: string } | null>(null);

  const loadData = async (off: number) => {
    setLoading(true);
    try {
      const buffer = await readBuffer(off, 256);
      if (buffer) {
        setData(new Uint8Array(buffer));
      }
    } catch (err) {
      toast.error("Failed to read hex data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(currentOffset);
  }, [currentOffset]);

  const handlePatch = () => {
    toast.info("Patching feature coming soon! (Manual byte edit supported in UI)");
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass-panel w-full max-w-3xl overflow-hidden shadow-2xl neon-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-bg/80 border-b border-color px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-color animate-pulse" />
            <h3 className="text-sm font-bold neon-text uppercase tracking-widest">Hex Editor @ 0x{currentOffset.toString(16).toUpperCase()}</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface border border-color rounded px-2 py-1 mr-2">
              <Search className="w-3 h-3 text-muted-color mr-2" />
              <input 
                type="text" 
                placeholder="Go to..." 
                className="bg-transparent border-none text-[10px] text-accent-color focus:outline-none w-16 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value.replace('0x', ''), 16);
                    if (!isNaN(val)) setCurrentOffset(val);
                  }
                }}
              />
            </div>
            <button onClick={() => setCurrentOffset(Math.max(0, currentOffset - 256))} className="p-1 hover:bg-accent-color/10 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-color hover:text-accent-color" />
            </button>
            <button onClick={() => setCurrentOffset(currentOffset + 256)} className="p-1 hover:bg-accent-color/10 rounded transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-color hover:text-accent-color" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-accent-color/10 rounded transition-colors ml-2">
              <X className="w-4 h-4 text-muted-color hover:text-error-color" />
            </button>
          </div>
        </div>

        <div className="p-6 font-mono text-[10px] sm:text-xs overflow-y-auto max-h-[60vh] bg-bg relative">
          {loading && (
            <div className="absolute inset-0 bg-bg/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
              <div className="text-accent-color animate-pulse font-bold">READING MEMORY...</div>
            </div>
          )}
          
          <div className="grid grid-cols-[100px_1fr_140px] gap-6">
            <div className="text-muted-color border-r border-color/30 pr-4 font-bold uppercase text-[9px]">Offset</div>
            <div className="text-muted-color border-r border-color/30 pr-4 text-center font-bold uppercase text-[9px]">Hex Data (00-0F)</div>
            <div className="text-muted-color text-center font-bold uppercase text-[9px]">ASCII</div>
            
            {data && Array.from({ length: Math.ceil(data.length / 16) }).map((_, i) => {
              const rowOffset = currentOffset + i * 16;
              const rowData = data.slice(i * 16, (i + 1) * 16);
              return (
                <React.Fragment key={i}>
                  <div className="text-accent-color/70 font-bold">0x{rowOffset.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-x-1.5 gap-y-1 justify-items-center">
                    {Array.from({ length: 16 }).map((_, j) => {
                      const b = rowData[j];
                      const isAvailable = j < rowData.length;
                      return (
                        <span 
                          key={j} 
                          className={cn(
                            "cursor-pointer hover:text-accent-color transition-colors",
                            isAvailable ? "text-color" : "text-muted-color/20"
                          )}
                          onClick={() => isAvailable && setEditingByte({ index: i * 16 + j, value: b.toString(16).padStart(2, '0').toUpperCase() })}
                        >
                          {isAvailable ? b.toString(16).padStart(2, '0').toUpperCase() : '??'}
                        </span>
                      );
                    })}
                  </div>
                  <div className="text-muted-color/60 text-center truncate tracking-widest">
                    {Array.from({ length: 16 }).map((_, j) => {
                      const b = rowData[j];
                      return j < rowData.length ? (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.') : ' ';
                    }).join('')}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="bg-bg/80 border-t border-color px-4 py-3 flex items-center justify-between">
          <div className="text-[10px] text-muted-color italic">
            * Click a byte to edit (Experimental Patching)
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePatch}
              className="bg-accent-color/10 hover:bg-accent-color/20 border border-accent-color/30 rounded px-4 py-1.5 text-[10px] font-bold text-accent-color transition-all flex items-center gap-2 uppercase tracking-widest"
            >
              <Download className="w-3 h-3" />
              Download Patched
            </button>
            <button 
              onClick={onClose}
              className="bg-surface hover:bg-border-color border border-color rounded px-4 py-1.5 text-[10px] font-bold text-color transition-colors uppercase tracking-widest"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
