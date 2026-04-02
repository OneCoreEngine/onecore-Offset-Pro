import React from 'react';
import { ELFRelocation } from '../lib/elf';

interface RelocationsViewProps {
  relocations: ELFRelocation[];
}

export const RelocationsView: React.FC<RelocationsViewProps> = ({ relocations }) => {
  return (
    <div className="bg-bg p-6 h-full overflow-auto">
      <div className="bg-surface border border-color rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-bg border-b border-color">
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Offset</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Info</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Symbol</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Addend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-color">
            {relocations.length > 0 ? (
              relocations.map((r, idx) => (
                <tr key={idx} className="hover:bg-accent-color/5 transition-colors group">
                  <td className="px-4 py-3 font-mono text-accent-color font-bold">0x{r.offset.toString(16).toUpperCase()}</td>
                  <td className="px-4 py-3 font-mono text-muted-color">0x{r.info.toString(16).toUpperCase()}</td>
                  <td className="px-4 py-3 text-muted-color">{r.type}</td>
                  <td className="px-4 py-3 font-mono text-color font-bold">{r.symbolName || '-'}</td>
                  <td className="px-4 py-3 font-mono text-muted-color">0x{r.addend.toString(16).toUpperCase()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-color italic">No relocation entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
