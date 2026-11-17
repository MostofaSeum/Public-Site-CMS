import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CMS_MESSAGE, buildPreviewUrl, listenForCmsMessages, postCmsMessage } from '../src/index';

// Minimal window: an EventTarget with an origin, enough for the message helpers.
beforeEach(() => {
  const fakeWindow = Object.assign(new EventTarget(), { location: { origin: 'https://admin.example.com' } });
  vi.stubGlobal('window', fakeWindow);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// Node's MessageEvent only accepts a MessagePort as `source`, so build the event by hand.
const dispatch = (data: unknown, origin: string, source: unknown = null) =>
  window.dispatchEvent(Object.assign(new Event('message'), { data, origin, source }));

describe('listenForCmsMessages', () => {
  it('accepts CMS messages from trusted origins only', () => {
    const handler = vi.fn();
    const stop = listenForCmsMessages(handler, { origins: ['https://admin.example.com'] });

    dispatch({ type: CMS_MESSAGE.CONTENT_UPDATED }, 'https://evil.example.com');
    dispatch({ type: 'SOMETHING_ELSE' }, 'https://admin.example.com');
    dispatch({ type: CMS_MESSAGE.CONTENT_UPDATED }, 'https://admin.example.com');
    expect(handler).toHaveBeenCalledTimes(1);

    stop();
    dispatch({ type: CMS_MESSAGE.CONTENT_UPDATED }, 'https://admin.example.com');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('checks the source window when one is required', () => {
    const handler = vi.fn();
    const parent = {};
    listenForCmsMessages(handler, { origins: ['https://admin.example.com'], source: () => parent as Window });
    dispatch({ type: CMS_MESSAGE.CONTENT_UPDATED }, 'https://admin.example.com', {});
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('postCmsMessage', () => {
  it('posts a cloned payload once per origin, never with "*"', () => {
    const postMessage = vi.fn();
    const draft = { title: 'x' };
    postCmsMessage(
      { postMessage } as unknown as Window,
      { type: CMS_MESSAGE.DRAFT_PREVIEW, page: 'home', sectionKey: 'hero', draftContent: draft },
      ['https://a.example', 'https://b.example']
    );
    expect(postMessage.mock.calls.map((c) => c[1])).toEqual(['https://a.example', 'https://b.example']);
    expect(postMessage.mock.calls[0][0].draftContent).not.toBe(draft);
  });
});

describe('buildPreviewUrl', () => {
  it('adds preview flags and the public site origin', () => {
    expect(buildPreviewUrl('/pricing', { editMode: true, cacheBust: 5 })).toBe('/pricing?cms_preview=1&cms_edit_mode=1&t=5');
    expect(buildPreviewUrl('/a?x=1', { publicSiteUrl: 'https://site.com/' })).toBe('https://site.com/a?x=1&cms_preview=1');
  });
});
