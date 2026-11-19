import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { CMS_MESSAGE, EDIT_MODE_PARAM, postCmsMessage } from '../core/messages';
import { CmsSectionContext, EDIT_BUTTON_Z_INDEX, claimFieldHover, releaseFieldHover } from './sectionContext';

export interface CmsFieldProps {
  /**
   * Where the value lives inside the section's content, in dot form:
   * "title", "image", "items.0.title". It can also point to a whole object or list ("items.0").
   */
  path: string;
  /** Name shown on the pencil button. Default: made from the path. */
  label?: string;
  children: React.ReactNode;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PENCIL_SIZE = 30;
const WINDOW_MARGIN = 4;
/** How long the pencil stays after the mouse leaves, so it can still be reached. */
const HIDE_DELAY_MS = 400;

function labelFromPath(path: string): string {
  const name = path.split('.').filter((part) => !/^\d+$/.test(part)).pop() ?? path;
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * CmsField
 *
 * Gives one value of a section its own pencil, so an editor can change just the title, the
 * image or the icon. Place it inside a <CmsSection>.
 *
 * Visitors get the children only, with no extra element. In the studio preview the wrapper uses
 * `display: contents`, so it does not affect the page layout.
 */
export const CmsField: React.FC<CmsFieldProps> = ({ path, label, children }) => {
  const section = useContext(CmsSectionContext);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const isEditMode = Boolean(section?.isEditMode);
  const showControls = isEditMode && isHovered;
  const name = label ?? labelFromPath(path);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hideNow: () => void = useCallback(() => {
    clearTimeout(hideTimer.current);
    setIsHovered(false);
    releaseFieldHover(hideNow);
  }, []);

  const show = () => {
    clearTimeout(hideTimer.current);
    claimFieldHover(hideNow);
    setIsHovered(true);
  };

  const hideSoon = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hideNow, HIDE_DELAY_MS);
  };

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      releaseFieldHover(hideNow);
    },
    [hideNow]
  );

  useEffect(() => {
    if (!section && new URLSearchParams(window.location.search).has(EDIT_MODE_PARAM)) {
      console.warn(`[storio-editor] <CmsField path="${path}"> must be placed inside a <CmsSection>.`);
    }
  }, [section, path]);

  // Follow the field while the mouse is on it, including content that moves by itself.
  useEffect(() => {
    if (!showControls) {
      setBox(null);
      return;
    }
    let frame = 0;
    const range = document.createRange();
    const measure = () => {
      const wrapper = wrapperRef.current;
      // Hold the pencil still while the mouse is on it, so moving content stays clickable.
      if (wrapper && !pencilRef.current?.matches(':hover')) {
        range.selectNodeContents(wrapper);
        const rect = range.getBoundingClientRect();
        setBox((prev) =>
          prev && prev.top === rect.top && prev.left === rect.left && prev.width === rect.width && prev.height === rect.height
            ? prev
            : { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        );
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [showControls]);

  if (!section || !isEditMode) return <>{children}</>;

  const openField = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.parent === window) return;
    postCmsMessage(
      window.parent,
      { type: CMS_MESSAGE.EDIT_SECTION, sectionKey: section.sectionKey, title: name, fieldPath: path },
      section.origins
    );
  };

  // Only the innermost field under the mouse is active.
  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (pencilRef.current?.contains(target) || target.closest('[data-cms-field]') === wrapperRef.current) show();
    else hideNow();
  };

  const pencilTop = box
    ? Math.min(Math.max(WINDOW_MARGIN, box.top - PENCIL_SIZE / 2), window.innerHeight - PENCIL_SIZE - WINDOW_MARGIN)
    : 0;
  const pencilLeft = box
    ? Math.min(
        Math.max(WINDOW_MARGIN, box.left + box.width - PENCIL_SIZE / 2),
        document.documentElement.clientWidth - PENCIL_SIZE - WINDOW_MARGIN
      )
    : 0;

  return (
    <span
      ref={wrapperRef}
      data-cms-field={path}
      style={{ display: 'contents' }}
      onClick={openField}
      onMouseOver={handleMouseOver}
      onMouseLeave={hideSoon}
    >
      {children}
      {showControls &&
        box &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              style={{
                position: 'fixed',
                top: box.top - 3,
                left: box.left - 3,
                width: box.width + 6,
                height: box.height + 6,
                border: '2px solid #a855f7',
                borderRadius: 6,
                pointerEvents: 'none',
                boxSizing: 'border-box',
                zIndex: EDIT_BUTTON_Z_INDEX,
              }}
            />
            <button
              ref={pencilRef}
              type="button"
              data-cms-field-button={path}
              onClick={openField}
              title={`Edit ${name}`}
              aria-label={`Edit ${name}`}
              style={{
                position: 'fixed',
                top: pencilTop,
                left: pencilLeft,
                width: PENCIL_SIZE,
                height: PENCIL_SIZE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                color: '#ffffff',
                background: '#9333ea',
                border: '2px solid #e9d5ff',
                borderRadius: 9999,
                boxShadow: '0 4px 14px rgba(59, 7, 100, 0.55)',
                cursor: 'pointer',
                zIndex: EDIT_BUTTON_Z_INDEX + 1,
              }}
            >
              <Pencil size={14} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </>,
          document.body
        )}
    </span>
  );
};
