import React from 'react';
import { ELFSegment } from '../lib/elf';

interface SegmentsViewProps {
  segments: ELFSegment[];
}

export const SegmentsView: React.FC<SegmentsViewProps> = ({ segments }) => {
  return (
    <div className="bg-bg p-6 h-full overflow-auto">
      <div className="bg-surface border border-color rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-bg border-b border-color">
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Offset</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">VirtAddr</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">FileSize</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">MemSize</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Flags</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Align</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-color">
            {segments.map((s, idx) => (
              <tr key={idx} className="hover:bg-accent-color/5 transition-colors group">
                <td className="px-4 py-3 font-bold text-color">{s.type}</td>
                <td className="px-4 py-3 font-mono text-accent-color">0x{s.offset.toString(16).toUpperCase()}</td>
                <td className="px-4 py-3 font-mono text-success-color font-bold">0x{s.vaddr.toString(16).toUpperCase()}</td>
                <td className="px-4 py-3 text-muted-color">{s.filesz} B</td>
                <td className="px-4 py-3 text-muted-color">{s.memsz} B</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-bg border border-color rounded font-mono text-[10px] text-color">
                    {s.flags}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-color font-mono">0x{s.align.toString(16).toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
