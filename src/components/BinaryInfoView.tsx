import React from 'react';
import { Cpu, Shield, File, Activity, Box, Layers, PieChart, Code2, X } from 'lucide-react';
import { ELFInfo, ELFSection, ELFSymbol } from '../lib/elf';
import { cn } from '../lib/utils';

interface BinaryInfoViewProps {
  binaryInfo: ELFInfo | null;
  file: File | null;
  soname: string;
  symbols: ELFSymbol[];
  strings: string[];
  dependencies: string[];
  sections: ELFSection[];
}

export const BinaryInfoView: React.FC<BinaryInfoViewProps> = ({
  binaryInfo,
  file,
  soname,
  symbols,
  strings,
  dependencies,
  sections
}) => {
  return (
    <div className="p-6 bg-bg space-y-6 overflow-auto h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-surface border border-color rounded-xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-accent-color mb-2">
            <Cpu className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Architecture Details</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Class</span>
              <span className="font-mono text-color">{binaryInfo?.class || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Data</span>
              <span className="font-mono text-color">{binaryInfo?.data || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Machine</span>
              <span className="font-mono text-accent-color font-bold">{binaryInfo?.machine || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Internal Name (SONAME)</span>
              <span className="font-mono text-primary-color font-bold">{soname}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface border border-color rounded-xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-success-color mb-2">
            <Shield className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-widest">System Info</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">OS/ABI</span>
              <span className="font-mono text-color">{binaryInfo?.osAbi || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Type</span>
              <span className="font-mono text-color">{binaryInfo?.type || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Entry Point</span>
              <span className="font-mono text-success-color font-bold">{binaryInfo?.entry || '0x0'}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface border border-color rounded-xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-primary-color mb-2">
            <File className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-widest">File Metadata</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">File Name</span>
              <span className="text-color truncate max-w-[150px]">{file?.name || 'Demo Binary'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">File Size</span>
              <span className="text-color">{(file?.size ? (file.size / 1024).toFixed(2) : '124.5')} KB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-color">Last Modified</span>
              <span className="text-color">{file?.lastModified ? new Date(file.lastModified).toLocaleDateString() : new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-surface border border-color rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-primary-color mb-3">
            <Activity className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest">Quick Stats</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-bg rounded-lg border border-color">
              <div className="text-lg font-bold text-color">{symbols.length}</div>
              <div className="text-[9px] text-muted-color uppercase">Symbols</div>
            </div>
            <div className="text-center p-2 bg-bg rounded-lg border border-color">
              <div className="text-lg font-bold text-color">{strings.length}</div>
              <div className="text-[9px] text-muted-color uppercase">Strings</div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface border border-color rounded-xl md:col-span-2 shadow-sm">
          <div className="flex items-center gap-2 text-yellow-500 mb-3">
            <Shield className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest">Security & Analysis</h4>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold",
              symbols.some(s => s.bind === 'LOCAL') ? "bg-success-color/10 border-success-color/20 text-success-color" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
            )}>
              {symbols.some(s => s.bind === 'LOCAL') ? <Shield className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {symbols.some(s => s.bind === 'LOCAL') ? "Not Stripped (Symbols Found)" : "Stripped Binary"}
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold",
              symbols.some(s => s.name.includes('__stack_chk_fail')) ? "bg-success-color/10 border-success-color/20 text-success-color" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
            )}>
              {symbols.some(s => s.name.includes('__stack_chk_fail')) ? <Shield className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {symbols.some(s => s.name.includes('__stack_chk_fail')) ? "Stack Canary Detected" : "No Stack Canary"}
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold",
              symbols.some(s => s.name.startsWith('Java_')) ? "bg-primary-color/10 border-primary-color/20 text-primary-color" : "bg-muted-color/10 border-muted-color/20 text-muted-color"
            )}>
              <Code2 className="w-3 h-3" />
              {symbols.some(s => s.name.startsWith('Java_')) ? "Contains JNI Methods" : "No JNI Methods"}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-surface border border-color rounded-xl shadow-sm">
        <div className="flex items-center gap-2 text-muted-color mb-4">
          <Layers className="w-4 h-4" />
          <h4 className="text-xs font-bold uppercase tracking-widest">Shared Library Dependencies</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {dependencies.length > 0 ? (
            dependencies.map((dep, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-bg border border-color rounded-lg group hover:border-accent-color transition-colors shadow-sm">
                <Box className="w-3 h-3 text-muted-color group-hover:text-accent-color" />
                <span className="text-xs font-mono text-color">{dep}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-4 w-full text-sm text-muted-color italic">No external dependencies found.</div>
          )}
        </div>
      </div>

      <div className="p-4 bg-surface border border-color rounded-xl shadow-sm">
        <div className="flex items-center gap-2 text-muted-color mb-4">
          <PieChart className="w-4 h-4" />
          <h4 className="text-xs font-bold uppercase tracking-widest">Section Size Distribution</h4>
        </div>
        <div className="space-y-4">
          {sections.length > 0 ? (
            <div className="flex h-8 w-full rounded-full overflow-hidden border border-color shadow-inner">
              {sections.slice(0, 8).map((s, i) => {
                const totalSize = sections.reduce((acc, curr) => acc + curr.size, 0);
                const percentage = (s.size / totalSize) * 100;
                const colors = ['bg-accent-color', 'bg-success-color', 'bg-primary-color', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-orange-500'];
                return (
                  <div 
                    key={i}
                    className={cn(colors[i % colors.length], "h-full transition-all hover:opacity-80")}
                    style={{ width: `${Math.max(2, percentage)}%` }}
                    title={`${s.name}: ${s.size} bytes (${percentage.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-color">No section data available</div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sections.slice(0, 8).map((s, i) => {
              const colors = ['bg-accent-color', 'bg-success-color', 'bg-primary-color', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-orange-500'];
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", colors[i % colors.length])} />
                  <span className="text-[10px] text-muted-color truncate">{s.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
