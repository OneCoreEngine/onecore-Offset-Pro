import React from 'react';
import { Copy, Search } from 'lucide-react';

interface StringsViewProps {
  strings: string[];
  searchQuery: string;
}

export const StringsView: React.FC<StringsViewProps> = ({ strings, searchQuery }) => {
  const filteredStrings = React.useMemo(() => {
    return strings.filter(str => str.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [strings, searchQuery]);

  const copyAll = () => {
    navigator.clipboard.writeText(filteredStrings.join('\n'));
    alert('Copied all visible strings to clipboard!');
  };

  return (
    <div className="bg-bg flex flex-col h-full">
      <div className="px-4 py-3 bg-surface border-b border-color flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-color">
            Showing {filteredStrings.length} strings
          </span>
        </div>
        <button 
          onClick={copyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-bg border border-color rounded-lg text-[10px] font-bold uppercase hover:border-accent-color transition-colors"
        >
          <Copy className="w-3 h-3" />
          Copy All
        </button>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-color">
        {filteredStrings.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-color italic">No strings found matching your search.</div>
        ) : filteredStrings.map((str, idx) => (
          <div key={idx} className="px-4 py-3 hover:bg-accent-color/5 transition-colors flex items-center justify-between group">
            <span className="text-sm font-mono text-color break-all">{str}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(str);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface rounded-lg transition-all"
              title="Copy to clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-muted-color" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
