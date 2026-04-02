import React from 'react';
import { Search, Filter, Copy, ExternalLink, Code2, Shield, Activity, X } from 'lucide-react';
import { ELFSymbol } from '../lib/elf';
import { demangle, isImportantSymbol } from '../lib/binaryUtils';
import { cn } from '../lib/utils';

interface SymbolsTableProps {
  symbols: ELFSymbol[];
  filteredSymbols: ELFSymbol[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterType: string;
  setFilterType: (t: string) => void;
  sortBy: { key: keyof ELFSymbol; direction: 'asc' | 'desc' };
  setSortBy: (config: { key: keyof ELFSymbol; direction: 'asc' | 'desc' }) => void;
  baseAddress: string;
  setBaseAddress: (addr: string) => void;
  setHexViewOffset: (offset: number | null) => void;
  copyAllOffsets: () => void;
  copyAsCppHeader: () => void;
}

export const SymbolsTable: React.FC<SymbolsTableProps> = ({
  symbols,
  filteredSymbols,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  sortBy,
  setSortBy,
  baseAddress,
  setBaseAddress,
  setHexViewOffset,
  copyAllOffsets,
  copyAsCppHeader
}) => {
  const requestSort = (key: keyof ELFSymbol) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortBy && sortBy.key === key && sortBy.direction === 'asc') {
      direction = 'desc';
    }
    setSortBy({ key, direction });
  };

  const baseAddrNum = parseInt(baseAddress.replace('0x', ''), 16) || 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-color bg-surface flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-color" />
            <input 
              type="text"
              placeholder="Filter symbols..."
              className="w-full bg-bg border border-color rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-color/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="bg-bg border border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-color/50"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="FUNC">Functions</option>
            <option value="OBJECT">Objects</option>
            <option value="NOTYPE">No Type</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-bg border border-color rounded-lg px-3 py-2 flex-1 md:w-48">
            <span className="text-[10px] font-bold text-muted-color uppercase">Base:</span>
            <input 
              type="text"
              placeholder="0x0"
              className="bg-transparent border-none p-0 text-sm font-mono focus:outline-none w-full text-accent-color"
              value={baseAddress}
              onChange={(e) => setBaseAddress(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            <button 
              onClick={copyAllOffsets}
              className="p-2 hover:bg-bg border border-color rounded-lg transition-colors"
              title="Copy all visible offsets"
            >
              <Copy className="w-4 h-4 text-muted-color" />
            </button>
            <button 
              onClick={copyAsCppHeader}
              className="p-2 hover:bg-bg border border-color rounded-lg transition-colors"
              title="Copy as C++ Header"
            >
              <Code2 className="w-4 h-4 text-muted-color" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="border-b border-color">
              <th className="p-3 text-left font-bold text-muted-color uppercase tracking-wider cursor-pointer hover:text-color" onClick={() => requestSort('name')}>Symbol Name</th>
              <th className="p-3 text-left font-bold text-muted-color uppercase tracking-wider cursor-pointer hover:text-color" onClick={() => requestSort('value')}>Offset</th>
              <th className="p-3 text-left font-bold text-muted-color uppercase tracking-wider">Absolute Address</th>
              <th className="p-3 text-left font-bold text-muted-color uppercase tracking-wider cursor-pointer hover:text-color" onClick={() => requestSort('size')}>Size</th>
              <th className="p-3 text-left font-bold text-muted-color uppercase tracking-wider cursor-pointer hover:text-color" onClick={() => requestSort('type')}>Type</th>
              <th className="p-3 text-left font-bold text-muted-color uppercase tracking-wider cursor-pointer hover:text-color" onClick={() => requestSort('bind')}>Bind</th>
              <th className="p-3 text-right font-bold text-muted-color uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-color">
            {filteredSymbols.length > 0 ? (
              filteredSymbols.map((s, i) => {
                const isImportant = isImportantSymbol(s.name);
                const demangledName = demangle(s.name);
                const absAddr = baseAddrNum + s.value;
                
                return (
                  <tr key={i} className={cn(
                    "hover:bg-accent-color/5 transition-colors group",
                    isImportant && "bg-primary-color/5"
                  )}>
                    <td className="p-3 max-w-md">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn(
                          "font-mono font-bold truncate",
                          isImportant ? "text-primary-color" : "text-color"
                        )} title={s.name}>
                          {s.name}
                        </span>
                        {demangledName !== s.name && (
                          <span className="text-[10px] text-muted-color italic truncate">
                            {demangledName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-accent-color font-bold">
                      <button 
                        onClick={() => setHexViewOffset(s.value)}
                        className="hover:underline"
                      >
                        0x{s.value.toString(16).toUpperCase()}
                      </button>
                    </td>
                    <td className="p-3 font-mono text-success-color">
                      0x{absAddr.toString(16).toUpperCase()}
                    </td>
                    <td className="p-3 text-muted-color">{s.size} B</td>
                    <td className="p-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        s.type === 'FUNC' ? "bg-primary-color/10 text-primary-color border border-primary-color/20" :
                        s.type === 'OBJECT' ? "bg-success-color/10 text-success-color border border-success-color/20" :
                        "bg-muted-color/10 text-muted-color border border-muted-color/20"
                      )}>
                        {s.type}
                      </span>
                    </td>
                    <td className="p-3 text-muted-color text-[10px]">{s.bind}</td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`0x${s.value.toString(16).toUpperCase()}`);
                        }}
                        className="p-1.5 hover:bg-surface rounded-lg text-muted-color hover:text-accent-color transition-all"
                        title="Copy Offset"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted-color italic">
                  No symbols found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
