import React from 'react';
import { Terminal } from 'lucide-react';

interface InspectorViewProps {
  filePreview: string | null;
}

export const InspectorView: React.FC<InspectorViewProps> = ({ filePreview }) => {
  return (
    <div className="p-6 bg-bg h-full overflow-auto">
      <div className="flex items-center gap-2 mb-4 text-muted-color">
        <Terminal className="w-4 h-4" />
        <h4 className="text-xs font-bold uppercase tracking-widest">Raw File Preview (First 8KB)</h4>
      </div>
      {filePreview ? (
        <pre className="text-[10px] font-mono leading-relaxed text-color overflow-x-auto whitespace-pre-wrap p-4 bg-surface border border-color rounded-lg max-h-[500px] shadow-sm">
          {filePreview}
        </pre>
      ) : (
        <div className="py-12 text-center text-sm text-muted-color italic">
          No preview available. Upload a file to inspect its contents.
        </div>
      )}
      <div className="mt-4 p-3 bg-accent-color/5 border border-accent-color/20 rounded-lg">
        <p className="text-[10px] text-muted-color italic">
          Note: Non-printable characters are replaced with dots (·). This view helps you identify if the file is a text script or a binary.
        </p>
      </div>
    </div>
  );
};
