import React from 'react';
import { ELFSection } from '../lib/elf';

interface SectionMapProps {
  sections: ELFSection[];
  fileSize: number;
}

export const SectionMap: React.FC<SectionMapProps> = ({ sections, fileSize }) => {
  if (fileSize === 0) return null;
  return (
    <div className="w-full h-8 bg-bg border border-color rounded-lg overflow-hidden flex mb-6 shadow-inner">
      {sections.sort((a, b) => a.offset - b.offset).map((section, idx) => {
        const width = (section.size / fileSize) * 100;
        if (width < 0.1) return null;
        return (
          <div 
            key={idx}
            className="h-full border-r border-color/20 hover:brightness-125 transition-all cursor-help relative group"
            style={{ 
              width: `${width}%`,
              backgroundColor: section.flags.includes('X') ? 'var(--primary-color)' : 
                               section.flags.includes('W') ? 'var(--success-color)' : 
                               'var(--accent-color)',
              opacity: 0.7
            }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-color rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-xl">
              <span className="font-bold">{section.name}</span>
              <div className="text-muted-color">Offset: 0x{section.offset.toString(16).toUpperCase()}</div>
              <div className="text-muted-color">Size: {section.size} B</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
