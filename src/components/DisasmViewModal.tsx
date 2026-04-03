import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code2, X, ChevronLeft, ChevronRight, Search, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface DisasmViewModalProps {
  offset: number;
  onClose: () => void;
  readBuffer: (offset: number, size: number) => Promise<ArrayBuffer | null>;
}

declare global {
  interface Window {
    capstone: any;
  }
}

export const DisasmViewModal: React.FC<DisasmViewModalProps> = ({ 
  offset: initialOffset, 
  onClose, 
  readBuffer 
}) => {
  const [currentOffset, setCurrentOffset] = useState(initialOffset);
  const [instructions, setInstructions] = useState<{ address: number; mnemonic: string; op_str: string; bytes: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [capstoneReady, setCapstoneReady] = useState(false);

  const initCapstone = async () => {
    if (window.capstone) {
      setCapstoneReady(true);
      return;
    }
    // Wait a bit for CDN script
    let attempts = 0;
    const interval = setInterval(() => {
      if (window.capstone) {
        setCapstoneReady(true);
        clearInterval(interval);
      }
      if (attempts++ > 20) clearInterval(interval);
    }, 200);
  };

  const decodeInstructions = async (off: number) => {
    setLoading(true);
    try {
      const buffer = await readBuffer(off, 128); // 32 instructions
      if (buffer && window.capstone) {
        const cs = new window.capstone.Capstone(window.capstone.ARCH_ARM64, window.capstone.MODE_ARM);
        const decoded = cs.disasm(new Uint8Array(buffer), off);
        setInstructions(decoded.map((ins: any) => ({
          address: ins.address,
          mnemonic: ins.mnemonic,
          op_str: ins.op_str,
          bytes: Array.from(ins.bytes).map((b: any) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
        })));
        cs.close();
      } else if (buffer) {
        // Fallback: Basic hex display if Capstone fails
        const view = new DataView(buffer);
        const fallback = [];
        for (let i = 0; i < buffer.byteLength; i += 4) {
          const ins = view.getUint32(i, true);
          fallback.push({
            address: off + i,
            mnemonic: 'DATA',
            op_str: `0x${ins.toString(16).padStart(8, '0').toUpperCase()}`,
            bytes: Array.from(new Uint8Array(buffer.slice(i, i + 4))).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
          });
        }
        setInstructions(fallback);
      }
    } catch (err) {
      console.error(err);
      toast.error("Disassembly failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initCapstone();
  }, []);

  useEffect(() => {
    decodeInstructions(currentOffset);
  }, [currentOffset, capstoneReady]);

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
            <Code2 className="w-4 h-4 text-accent-color animate-pulse" />
            <h3 className="text-sm font-bold neon-text uppercase tracking-widest">ARM64 Disassembler @ 0x{currentOffset.toString(16).toUpperCase()}</h3>
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
            <button onClick={() => setCurrentOffset(Math.max(0, currentOffset - 128))} className="p-1 hover:bg-accent-color/10 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-color hover:text-accent-color" />
            </button>
            <button onClick={() => setCurrentOffset(currentOffset + 128)} className="p-1 hover:bg-accent-color/10 rounded transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-color hover:text-accent-color" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-accent-color/10 rounded transition-colors ml-2">
              <X className="w-4 h-4 text-muted-color hover:text-error-color" />
            </button>
          </div>
        </div>

        <div className="p-6 font-mono text-[10px] sm:text-xs overflow-y-auto max-h-[60vh] bg-bg relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 bg-bg/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
              <div className="text-accent-color animate-pulse font-bold">ANALYZING INSTRUCTIONS...</div>
            </div>
          )}
          
          <div className="space-y-1">
            {instructions.map((ins, i) => (
              <div key={i} className="grid grid-cols-[100px_120px_60px_1fr] gap-4 py-1 hover:bg-accent-color/5 transition-colors rounded px-2 group">
                <div className="text-accent-color/50 font-bold">0x{ins.address.toString(16).toUpperCase()}</div>
                <div className="text-muted-color/40 text-[9px] truncate">{ins.bytes}</div>
                <div className="text-accent-color font-bold uppercase">{ins.mnemonic}</div>
                <div className="text-color group-hover:text-accent-color transition-colors">{ins.op_str}</div>
              </div>
            ))}
            {instructions.length === 0 && !loading && (
              <div className="text-center py-20 text-muted-color italic">
                {capstoneReady ? "No instructions decoded at this offset." : "Waiting for Capstone engine..."}
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg/80 border-t border-color px-4 py-3 flex items-center justify-between">
          <div className="text-[10px] text-muted-color italic flex items-center gap-2">
            <Terminal className="w-3 h-3" />
            Capstone Engine: {capstoneReady ? <span className="text-accent-color">ONLINE</span> : <span className="text-error-color">OFFLINE (FALLBACK MODE)</span>}
          </div>
          <button 
            onClick={onClose}
            className="bg-surface hover:bg-border-color border border-color rounded px-4 py-1.5 text-[10px] font-bold text-color transition-colors uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
