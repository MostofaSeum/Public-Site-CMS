import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Smartphone, Tablet, Monitor, RefreshCw, ExternalLink } from 'lucide-react';
import { buildPreviewUrl, publicUrl } from '../core/paths';
import { useStudio } from './StudioContext';

interface LivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pagePath: string; // e.g. '/', '/templates', '/developers'
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export const LivePreviewModal: React.FC<LivePreviewModalProps> = ({
  isOpen,
  onClose,
  pagePath,
}) => {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  const { config } = useStudio();

  if (!isOpen || typeof document === 'undefined') return null;

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile':
        return 'w-[375px] h-[667px]';
      case 'tablet':
        return 'w-[768px] h-[1024px]';
      default:
        return 'w-full h-full';
    }
  };

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const getPublicLiveUrl = (route: string) => publicUrl(route, config.publicSiteUrl);

  const iframeSrc = buildPreviewUrl(pagePath, { publicSiteUrl: config.publicSiteUrl, cacheBust: iframeKey });

  // Rendered on document.body so no part of the editor can sit on top of it.
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-950/90 backdrop-blur-md animate-fadeIn">
      {/* Top Bar */}
      <div className="h-14 border-b border-purple-500/20 bg-slate-900/90 px-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm sm:text-base text-purple-300">
            Live Preview: <code className="text-white bg-slate-800 px-2 py-0.5 rounded">{pagePath}</code>
          </span>
          <a
            href={getPublicLiveUrl(pagePath)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors bg-slate-800/80 px-2 py-1 rounded border border-slate-700"
          >
            <span>Open in Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700/60">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium ${
              device === 'desktop'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Desktop view"
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium ${
              device === 'tablet'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Tablet view (768px)"
          >
            <Tablet className="w-4 h-4" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium ${
              device === 'mobile'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Mobile view (375px)"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
        <div
          className={`transition-all duration-300 shadow-2xl rounded-xl overflow-hidden border border-purple-500/30 bg-white ${getDeviceWidth()}`}
        >
          <iframe
            key={iframeKey}
            src={iframeSrc}
            title="Live Preview"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

