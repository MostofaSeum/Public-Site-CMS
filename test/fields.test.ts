import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getAtPath, parseFieldPath } from '../src/core/paths';
import { isCmsMessage, CMS_MESSAGE } from '../src/core/messages';
import { defineCms } from '../src/core/defineCms';
import { memoryAdapter } from '../src/adapters/memory';
import { CmsField, CmsProvider, CmsSection } from '../src/site';

const content = { title: 'Hi', image: '', items: [{ title: 'One', tags: ['a', 'b'] }], on: false, count: 0 };

describe('field paths', () => {
  it('turns list positions into numbers', () => {
    expect(parseFieldPath('items.0.title')).toEqual(['items', 0, 'title']);
  });

  it('finds values at any depth, including empty ones', () => {
    expect(getAtPath(content, parseFieldPath('title'))).toBe('Hi');
    expect(getAtPath(content, parseFieldPath('items.0.title'))).toBe('One');
    expect(getAtPath(content, parseFieldPath('items.0.tags.1'))).toBe('b');
    expect(getAtPath(content, parseFieldPath('items.0'))).toEqual(content.items[0]);
    expect(getAtPath(content, parseFieldPath('image'))).toBe('');
    expect(getAtPath(content, parseFieldPath('on'))).toBe(false);
    expect(getAtPath(content, parseFieldPath('count'))).toBe(0);
  });

  it('returns undefined for anything that does not exist', () => {
    expect(getAtPath(content, parseFieldPath('missing'))).toBeUndefined();
    expect(getAtPath(content, parseFieldPath('items.5.title'))).toBeUndefined();
    expect(getAtPath(content, parseFieldPath('title.length'))).toBeUndefined();
    expect(getAtPath(null, parseFieldPath('title'))).toBeUndefined();
  });

  it('never reaches inherited properties', () => {
    expect(getAtPath(content, parseFieldPath('__proto__'))).toBeUndefined();
    expect(getAtPath(content, parseFieldPath('constructor.prototype'))).toBeUndefined();
    expect(getAtPath(content, parseFieldPath('items.length'))).toBeUndefined();
  });
});

describe('CmsField', () => {
  const config = defineCms({
    adapter: memoryAdapter(),
    pages: [{ key: 'home', title: 'Home', route: '/', sections: [{ key: 'hero', label: 'Hero' }], defaults: { hero: { title: 'Hi' } } }],
  });

  it('adds nothing to the page for visitors', () => {
    const field = React.createElement(CmsField, { path: 'title' }, React.createElement('h1', null, 'Hi'));
    const section = React.createElement(CmsSection, { sectionKey: 'hero', title: 'Hero' }, field);
    expect(renderToStaticMarkup(React.createElement(CmsProvider, { config }, section))).toBe('<h1>Hi</h1>');
  });

  it('renders its children outside a section', () => {
    expect(renderToStaticMarkup(React.createElement(CmsField, { path: 'title' }, 'Hi'))).toBe('Hi');
  });

  it('sends the field path with the existing edit message', () => {
    expect(isCmsMessage({ type: CMS_MESSAGE.EDIT_SECTION, sectionKey: 'hero', fieldPath: 'items.0.title' })).toBe(true);
  });
});
