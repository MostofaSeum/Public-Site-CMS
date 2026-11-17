import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Layers, CheckCircle2, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SectionDetail, SectionMetadata } from '../core/types';
import { findPage } from '../core/defineCms';
import { getSectionDetail, listManagedSections } from '../core/merge';
import { SectionEditorForm } from './SectionEditorForm';
import { useStudio } from './StudioContext';

export interface FormStudioProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

/** List-and-form editor: page tabs, a searchable section list and the section form. */
export const FormStudio: React.FC<FormStudioProps> = ({ activePage, onPageChange }) => {
  const { config } = useStudio();
  const adapter = config.adapter;

  const [sections, setSections] = useState<SectionMetadata[]>([]);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('');
  const [currentSectionDetail, setCurrentSectionDetail] = useState<SectionDetail | null>(null);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load sections list
  const loadSections = useCallback(async () => {
    setLoadingSections(true);
    try {
      const records = await adapter.listRecords(undefined, { includeDrafts: true });
      setSections(listManagedSections(config.pages, records));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sections');
    } finally {
      setLoadingSections(false);
    }
  }, [adapter, config.pages]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Filter sections by active page
  const pageSections = useMemo(
    () => sections.filter((s) => s.page === activePage),
    [sections, activePage]
  );

  // A section key from the previous page is not valid until the auto-select
  // effect below switches to a section that belongs to the new page.
  const selectedSectionExistsOnPage = pageSections.some((s) => s.sectionKey === selectedSectionKey);

  // Set default selected section when page changes
  useEffect(() => {
    if (pageSections.length === 0) return;
    if (!selectedSectionExistsOnPage) {
      setSelectedSectionKey(pageSections[0].sectionKey);
    }
  }, [pageSections, selectedSectionExistsOnPage]);

  // Load selected section details
  const loadSectionDetail = useCallback(
    async (page: string, sectionKey: string) => {
      const pageDef = findPage(config, page);
      if (!pageDef || !sectionKey) return;
      setLoadingDetail(true);
      try {
        const record = await adapter.getRecord(page, sectionKey, { includeDrafts: true });
        setCurrentSectionDetail(getSectionDetail(pageDef, sectionKey, record));
      } catch (err) {
        console.error(err);
        toast.error(`Failed to load content for '${sectionKey}'`);
      } finally {
        setLoadingDetail(false);
      }
    },
    [adapter, config]
  );

  useEffect(() => {
    if (!selectedSectionKey || !selectedSectionExistsOnPage) return;
    loadSectionDetail(activePage, selectedSectionKey);
  }, [activePage, selectedSectionKey, selectedSectionExistsOnPage, loadSectionDetail]);

  const handleSaveSection = async (content: unknown, isPublished: boolean) => {
    await adapter.saveRecord({ page: activePage, sectionKey: selectedSectionKey, content, isPublished });
    await loadSections();
    await loadSectionDetail(activePage, selectedSectionKey);
  };

  const handleResetSection = async () => {
    await adapter.deleteRecord(activePage, selectedSectionKey);
    await loadSections();
    await loadSectionDetail(activePage, selectedSectionKey);
  };

  const pageDef = findPage(config, activePage);
  const labelFor = (key: string) =>
    pageDef?.sections.find((s) => s.key === key)?.label || key.replace(/([A-Z])/g, ' $1');

  const filteredSections = pageSections.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.sectionKey.toLowerCase().includes(q) || labelFor(s.sectionKey).toLowerCase().includes(q);
  });

  const totalSectionsCount = sections.length;
  const customOverridesCount = sections.filter((s) => s.hasCustomOverride).length;
  const selectedSectionDef = pageDef?.sections.find((s) => s.key === selectedSectionKey);

  return (
    <div className="space-y-6">
      {/* Overview stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-500/20 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black">{totalSectionsCount}</div>
            <div className="text-xs text-slate-400">Total Editable Sections</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-500/20 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">{customOverridesCount}</div>
            <div className="text-xs text-slate-400">Custom Overrides</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-500/20 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-blue-300">{totalSectionsCount - customOverridesCount}</div>
            <div className="text-xs text-slate-400">Using Defaults</div>
          </div>
        </div>
      </div>

      {/* Page tabs */}
      <div className="flex items-center gap-2 border-b border-purple-500/20 pb-2 overflow-x-auto">
        {config.pages.map(({ key, title, route, icon: Icon }) => {
          const isActive = activePage === key;
          const count = sections.filter((s) => s.page === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPageChange(key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{title}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 text-purple-200">
                {route}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                isActive ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main layout: left section navigator + right editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left section list */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-purple-500/20 rounded-2xl p-4 backdrop-blur-sm space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1.5 custom-scrollbar">
            {loadingSections ? (
              <div className="p-4 text-center text-xs text-slate-500">Loading sections...</div>
            ) : filteredSections.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No matching sections found.</div>
            ) : (
              filteredSections.map((sec) => {
                const isSelected = sec.sectionKey === selectedSectionKey;
                return (
                  <button
                    key={sec.sectionKey}
                    type="button"
                    onClick={() => setSelectedSectionKey(sec.sectionKey)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-purple-600/30 border border-purple-500 text-white shadow-sm'
                        : 'bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          sec.hasCustomOverride ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-semibold capitalize">{labelFor(sec.sectionKey)}</div>
                        <div className="text-[10px] text-slate-500 font-mono">key: {sec.sectionKey}</div>
                      </div>
                    </div>

                    <div>
                      {sec.hasCustomOverride ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                          Custom
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          Default
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right editor form */}
        <div className="lg:col-span-8">
          {loadingDetail ? (
            <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/60 rounded-2xl border border-purple-500/20">
              Loading section data...
            </div>
          ) : currentSectionDetail ? (
            <SectionEditorForm
              key={`${activePage}-${selectedSectionKey}`}
              page={activePage}
              sectionKey={selectedSectionKey}
              sectionLabel={selectedSectionDef?.label}
              pagePath={pageDef?.route || '/'}
              transform={selectedSectionDef?.transform}
              initialData={currentSectionDetail.content}
              hasCustomOverride={currentSectionDetail.hasCustomOverride}
              isPublished={currentSectionDetail.isPublished}
              updatedAt={currentSectionDetail.updatedAt}
              updatedBy={currentSectionDetail.updatedBy}
              onSave={handleSaveSection}
              onReset={handleResetSection}
            />
          ) : (
            <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/60 rounded-2xl border border-purple-500/20">
              Select a section from the list to begin editing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
