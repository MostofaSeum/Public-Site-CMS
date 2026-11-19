import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, X } from 'lucide-react';
import { POPULAR_ICONS, getDynamicIcon } from './dynamicIcon';
import type { IconComponent } from '../core/types';

interface VisualIconPickerProps {
  value: string;
  onChange: (newIconName: string) => void;
  label?: string;
  fieldId?: string;
  /** The site's own icons (config.icons). When given, only these are offered. */
  icons?: Record<string, IconComponent>;
}

export const VisualIconPicker: React.FC<VisualIconPickerProps> = ({
  value,
  onChange,
  label,
  fieldId,
  icons,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The site's own icons when configured, so a picked icon always renders on the site.
  const catalog = useMemo(
    () => (icons ? Object.keys(icons).map((name) => ({ name, category: 'Site icons' })) : POPULAR_ICONS),
    [icons]
  );
  const resolveIcon = (name: string): React.ComponentType<{ className?: string }> =>
    icons ? icons[name] ?? getDynamicIcon(name) : getDynamicIcon(name);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((i) => i.category));
    return set.size > 1 ? ['all', ...Array.from(set)] : [];
  }, [catalog]);

  const filteredIcons = useMemo(() => {
    return catalog.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchSearch =
        !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchCat && matchSearch;
    });
  }, [catalog, search, activeCategory]);

  const CurrentIcon = resolveIcon(value || 'Sparkles');
  const isUnknownSiteIcon = Boolean(icons && value && !icons[value]);

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl md:max-w-2xl bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{icons ? 'Choose Icon' : 'Choose Lucide Icon'}</h3>
              <p className="text-[11px] text-slate-400">
                Select an icon for <span className="font-mono text-purple-300">{label || fieldId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search icons (e.g. graduation, star, check, globe, book)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap capitalize transition-all ${
                  activeCategory === cat
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Icon Grid - Fixed responsive columns and full icon names visible */}
        <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredIcons.map((item) => {
              const IconComp = resolveIcon(item.name);
              const isSelected = (value || '').toLowerCase() === item.name.toLowerCase();

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    onChange(item.name);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all group min-h-[90px] ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/50 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform text-slate-300 group-hover:text-purple-300 shrink-0">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-slate-300 truncate w-full px-1">
                    {item.name}
                  </span>
                  {isSelected && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {filteredIcons.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No icons found matching &quot;{search}&quot;. Try another search term.
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label className="text-xs font-semibold text-slate-300 capitalize flex items-center gap-1.5">
          
          <span>{label?.replace(/([A-Z])/g, ' $1') || 'Icon'}</span>
        </label>
        {fieldId && <span className="text-[10px] font-mono text-slate-500">{fieldId}</span>}
      </div>

      {/* Inline Picker Trigger - Clean Full-Width Responsive Card */}
      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
            <CurrentIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white font-mono truncate">
              {value || 'None selected'}
            </div>
            <div className={`text-[10px] truncate ${isUnknownSiteIcon ? 'text-amber-400' : 'text-slate-400'}`}>
              {isUnknownSiteIcon ? 'The site cannot draw this icon. Pick another.' : icons ? 'Site icon' : 'Lucide icon'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shrink-0 ml-auto"
        >
          Select Icon
        </button>
      </div>

      {/* Render Modal via createPortal to body to prevent clipping inside sidebar */}
      {mounted && typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </div>
  );
};
