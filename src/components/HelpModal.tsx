import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface HelpModalProps {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ showHelp, setShowHelp }) => {
  if (!showHelp) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowHelp(false)}
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-surface border border-color rounded-xl w-full max-w-lg overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-bg border-b border-color px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-color">How to use OneCore Offset Finder</h3>
            <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-bg rounded transition-colors">
              <X className="w-4 h-4 text-muted-color" />
            </button>
          </div>
          <div className="p-6 space-y-4 text-sm text-muted-color">
            <section>
              <h4 className="text-color font-bold mb-1">1. Upload File</h4>
              <p>Drag and drop your <code className="bg-bg px-1 rounded">.so</code> file into the dashboard. All processing happens locally on your device.</p>
            </section>
            <section>
              <h4 className="text-color font-bold mb-1">2. Find Offsets</h4>
              <p>Search for function names (e.g., <code className="bg-bg px-1 rounded">JNI_OnLoad</code>) to find their relative offsets in the binary.</p>
            </section>
            <section>
              <h4 className="text-color font-bold mb-1">3. Base Address</h4>
              <p>If you know the memory address where the library is loaded, enter it in the "Base Address" field to calculate absolute addresses.</p>
            </section>
            <section>
              <h4 className="text-color font-bold mb-1">4. Hex View</h4>
              <p>Click on any offset to see the raw binary data at that location. Useful for verifying function signatures or data structures.</p>
            </section>
            <section>
              <h4 className="text-color font-bold mb-1">5. Architecture Support</h4>
              <p>This tool fully supports both <span className="text-accent-color font-bold">32-bit (ARM, x86)</span> and <span className="text-accent-color font-bold">64-bit (ARM64, x86_64)</span> ELF binaries. It automatically detects the architecture and adjusts the parsing logic accordingly.</p>
            </section>
            <section>
              <h4 className="text-color font-bold mb-1">6. Common Issues</h4>
              <p className="mb-1 text-accent-color font-semibold">"Not a valid ELF / Text file detected"</p>
              <p>This happens if you upload a <code className="bg-bg px-1 rounded">linker script</code> or a text file instead of the compiled binary. Look for the larger <code className="bg-bg px-1 rounded">.so</code> file in your <code className="bg-bg px-1 rounded">libs/</code> or <code className="bg-bg px-1 rounded">obj/</code> folders.</p>
            </section>
            <section>
              <h4 className="text-color font-bold mb-1">7. Inspector Tab</h4>
              <p>If a file fails to parse, use the <span className="text-accent-color font-bold">Inspector</span> tab to see the raw content of the file. This helps you verify if you uploaded the correct binary.</p>
            </section>
            <div className="p-3 bg-primary-color/5 border border-primary-color/20 rounded-lg">
              <p className="text-[11px] italic">Tip: Use the "Copy as C++ Header" button in the export menu to quickly generate code for your projects.</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
