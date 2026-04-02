import React from 'react';
import { ELFSection } from '../lib/elf';
import { SectionMap } from './SectionMap';
import { cn } from '../lib/utils';

interface SectionsViewProps {
  sections: ELFSection[];
  fileSize: number;
}

export const SectionsView: React.FC<SectionsViewProps> = ({ sections, fileSize }) => {
  return (
    <div className="bg-bg p-6 h-full overflow-auto">
      <SectionMap sections={sections} fileSize={fileSize} />
      <div className="bg-surface border border-color rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-surface border-b border-color flex items-center gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-color">Legend:</span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 flex items-center justify-center bg-bg border border-color rounded text-success-color font-bold">W</span>
            <span className="text-muted-color">Writable</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 flex items-center justify-center bg-bg border border-color rounded text-accent-color font-bold">A</span>
            <span className="text-muted-color">Allocated</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 flex items-center justify-center bg-bg border border-color rounded text-primary-color font-bold">X</span>
            <span className="text-muted-color">Executable</span>
          </div>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-bg border-b border-color">
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Section Name</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Offset</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Size</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-color">
            {sections.map((s, idx) => (
              <tr key={idx} className="hover:bg-accent-color/5 transition-colors group">
                <td className="px-4 py-3 font-mono font-bold text-color">{s.name}</td>
                <td className="px-4 py-3 font-mono text-accent-color">0x{s.offset.toString(16).toUpperCase()}</td>
                <td className="px-4 py-3 text-muted-color">{s.size} B</td>
                <td className="px-4 py-3 text-muted-color">{s.type}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {s.flags.split('').map((f, i) => (
                      <span key={i} className={cn(
                        "w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold border",
                        f === 'W' ? "bg-success-color/10 text-success-color border-success-color/20" :
                        f === 'A' ? "bg-accent-color/10 text-accent-color border-accent-color/20" :
                        f === 'X' ? "bg-primary-color/10 text-primary-color border-primary-color/20" :
                        "bg-muted-color/10 text-muted-color border-muted-color/20"
                      )}>
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
