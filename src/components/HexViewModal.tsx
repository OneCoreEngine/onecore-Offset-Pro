import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface HexViewModalProps {
  hexViewOffset: number | null;
  setHexViewOffset: (offset: number | null) => void;
  arrayBuffer: ArrayBuffer | null;
}

export const HexViewModal: React.FC<HexViewModalProps> = ({ 
  hexViewOffset, 
  setHexViewOffset, 
  arrayBuffer 
}) => {
  const hexViewData = React.useMemo(() => {
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

  if (hexViewOffset === null || !hexViewData) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={() => setHexViewOffset(null)}
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-surface border border-color rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-bg border-b border-color px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent-color" />
              <h3 className="text-sm font-semibold text-color">Hex View @ 0x{hexViewOffset.toString(16).toUpperCase()}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const target = prompt('Enter offset (hex):', '0x0');
                  if (target) {
                    const val = parseInt(target.replace('0x', ''), 16);
                    if (!isNaN(val)) setHexViewOffset(val);
                  }
                }}
                className="p-1 hover:bg-surface rounded text-xs text-accent-color font-mono"
              >
                Go To
              </button>
              <button 
                onClick={() => setHexViewOffset(Math.max(0, (hexViewOffset || 0) - 256))}
                className="p-1 hover:bg-surface rounded text-xs text-muted-color"
              >
                Prev
              </button>
              <button 
                onClick={() => setHexViewOffset((hexViewOffset || 0) + 256)}
                className="p-1 hover:bg-surface rounded text-xs text-muted-color"
              >
                Next
              </button>
              <button onClick={() => setHexViewOffset(null)} className="p-1 hover:bg-surface rounded transition-colors">
                <X className="w-4 h-4 text-muted-color" />
              </button>
            </div>
          </div>
          <div className="p-4 font-mono text-[10px] sm:text-xs overflow-y-auto max-h-[60vh] bg-bg">
            <div className="grid grid-cols-[80px_1fr_120px] gap-4">
              <div className="text-muted-color border-r border-color pr-2">Offset</div>
              <div className="text-muted-color border-r border-color pr-2 text-center">Hex Data</div>
              <div className="text-muted-color text-center">ASCII</div>
              
              {Array.from({ length: Math.ceil(hexViewData.data.length / 16) }).map((_, i) => {
                const rowOffset = hexViewData.offset + i * 16;
                const rowData = hexViewData.data.slice(i * 16, (i + 1) * 16);
                return (
                  <React.Fragment key={i}>
                    <div className="text-accent-color">0x{rowOffset.toString(16).padStart(8, '0').toUpperCase()}</div>
                    <div className="flex gap-1.5 justify-center">
                      {rowData.map((b, j) => (
                        <span key={j} className="text-color">{b.toString(16).padStart(2, '0').toUpperCase()}</span>
                      ))}
                    </div>
                    <div className="text-muted-color text-center truncate">
                      {rowData.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="bg-bg border-t border-color px-4 py-3 flex justify-end">
            <button 
              onClick={() => setHexViewOffset(null)}
              className="bg-surface hover:opacity-80 border border-color rounded-md px-4 py-1.5 text-xs font-semibold text-color transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
