import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { CMS_MESSAGE, listenForCmsMessages, postCmsMessage } from '../core/messages';
import { useCmsEditMode } from './preview';
import { useCmsContext } from './CmsProvider';

export interface CmsSectionProps {
  sectionKey: string;
  title: string;
  /**
   * Optional pathname (for example "/") that this section belongs to.
   * Shared components such as a navbar render on every page, so without this
   * guard their edit button would appear on pages that do not own the section.
   */
  activeOnPath?: string;
  /**
   * Where the floating edit button sits. Use "fixed" for sticky headers and
   * banners whose own box is too small to hold the button.
   */
  buttonPlacement?: 'inside' | 'inside-low' | 'fixed';
  children: React.ReactNode;
}

const BUTTON_PLACEMENT_CLASSES: Record<NonNullable<CmsSectionProps['buttonPlacement']>, string> = {
  inside: 'absolute top-6 right-8 z-40',
  'inside-low': 'absolute top-28 right-8 z-40',
  fixed: 'fixed top-24 right-8 z-[10000]',
};

/**
 * CmsSection
 *
 * In normal visitor mode: renders children directly with zero overhead.
 * In CMS edit mode (?cms_edit_mode=1 inside the studio preview):
 *  - Adds an outline and a floating edit button on hover.
 *  - Listens for SCROLL_TO_SECTION from the studio to centre and pulse the section.
 *  - Clicking anywhere on the section tells the studio to open this section's form.
 */
export const CmsSection: React.FC<CmsSectionProps> = ({
  sectionKey,
  title,
  activeOnPath,
  buttonPlacement = 'inside',
  children,
}) => {
  const { origins } = useCmsContext();
  const isEditMode = useCmsEditMode(origins);
  const [pathname, setPathname] = useState<string | null>(null);
  const [isTargeted, setIsTargeted] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const originsKey = origins.join('|');

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const isValidPath = !activeOnPath || pathname === activeOnPath;

  // Listen for scroll commands from the studio
  useEffect(() => {
    if (!isEditMode) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = listenForCmsMessages(
      (message) => {
        if (message.type === CMS_MESSAGE.SCROLL_TO_SECTION && message.sectionKey === sectionKey) {
          if (sectionRef.current) {
            sectionRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
            setIsTargeted(true);
            clearTimeout(timer);
            timer = setTimeout(() => setIsTargeted(false), 2400);
          }
        }
      },
      { origins, source: () => window.parent }
    );

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, sectionKey, originsKey]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      postCmsMessage(
        window.parent,
        {
          type: CMS_MESSAGE.EDIT_SECTION,
          sectionKey,
          title,
        },
        origins
      );
    }
  };

  // Zero wrapper overhead for normal visitors
  if (!isEditMode || !isValidPath) {
    return <>{children}</>;
  }

  return (
    <div
      ref={sectionRef}
      data-cms-section={sectionKey}
      onClick={handleEditClick}
      className={`relative group/cms-section transition-all duration-300 cursor-pointer rounded-2xl ${
        isTargeted
          ? 'ring-4 ring-purple-500 ring-offset-4 ring-offset-slate-950 shadow-[0_0_60px_rgba(168,85,247,0.5)]'
          : 'hover:ring-2 hover:ring-purple-500 hover:ring-offset-2 hover:ring-offset-slate-900'
      }`}
    >
      {/* Floating edit button, positioned so it does not cover the section's own controls */}
      <div
        className={`pointer-events-auto transition-all duration-200 transform group-hover/cms-section:scale-100 scale-95 ${
          isTargeted ? 'opacity-100 scale-100' : 'opacity-0 group-hover/cms-section:opacity-100'
        } ${BUTTON_PLACEMENT_CLASSES[buttonPlacement]}`}
      >
        <button
          type="button"
          onClick={handleEditClick}
          className="flex items-center gap-2.5 px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm sm:text-base tracking-wide shadow-2xl shadow-purple-950/80 border-2 border-purple-300/80 backdrop-blur-xl cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          title={`Edit ${title} in the editor panel`}
        >
          <Pencil className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-purple-100" />
          <span className="drop-shadow-sm">Edit {title}</span>
        </button>
      </div>

      {children}
    </div>
  );
};
