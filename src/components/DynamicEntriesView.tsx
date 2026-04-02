import React from 'react';
import { ELFDynamicEntry } from '../lib/elf';

interface DynamicEntriesViewProps {
  dynamicEntries: ELFDynamicEntry[];
}

export const DynamicEntriesView: React.FC<DynamicEntriesViewProps> = ({ dynamicEntries }) => {
  return (
    <div className="bg-bg p-6 h-full overflow-auto">
      <div className="bg-surface border border-color rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-bg border-b border-color">
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Tag</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Value / Offset</th>
              <th className="px-4 py-3 font-bold text-muted-color uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-color">
            {dynamicEntries.length > 0 ? (
              dynamicEntries.map((d, idx) => (
                <tr key={idx} className="hover:bg-accent-color/5 transition-colors group">
                  <td className="px-4 py-3 font-mono text-accent-color font-bold">0x{d.tag.toString(16).toUpperCase()}</td>
                  <td className="px-4 py-3 font-bold text-color">{d.type}</td>
                  <td className="px-4 py-3 font-mono text-success-color font-bold">0x{d.value.toString(16).toUpperCase()}</td>
                  <td className="px-4 py-3 text-muted-color italic">{d.description || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-color italic">No dynamic entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
