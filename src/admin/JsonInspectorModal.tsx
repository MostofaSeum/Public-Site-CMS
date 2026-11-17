import React, { useState, useEffect } from 'react';
import { X, Copy, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface JsonInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  jsonData: unknown;
  onApply: (data: unknown) => void;
}

export const JsonInspectorModal: React.FC<JsonInspectorModalProps> = ({
  isOpen,
  onClose,
  sectionTitle,
  jsonData,
  onApply,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (jsonData !== undefined) {
      setText(JSON.stringify(jsonData, null, 2));
      setError(null);
    }
  }, [jsonData, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied JSON to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    try {
      JSON.parse(val);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(text);
      onApply(parsed);
      toast.success('Applied JSON edits to form');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format');
      toast.error('Please fix JSON syntax errors before applying');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between bg-slate-800/80">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Raw JSON Inspector:</span>
              <span className="text-purple-400 font-mono text-sm">{sectionTitle}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Direct JSON editing for power users. Changes are validated before applying.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 transition-colors border border-slate-600"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Textarea Editor */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <textarea
            value={text}
            onChange={handleTextChange}
            spellCheck={false}
            className="w-full flex-1 min-h-[400px] font-mono text-xs p-4 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 resize-none"
          />
          {error && (
            <div className="mt-2 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-500/20 bg-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {error ? 'Fix errors to apply' : 'Syntax valid'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={error !== null}
              className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                error !== null
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
              }`}
            >
              Apply to Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

