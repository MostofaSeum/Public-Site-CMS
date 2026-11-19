import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getAtPath, parseFieldPath } from '../src/core/paths';
import { isCmsMessage, CMS_MESSAGE } from '../src/core/messages';
import { defineCms } from '../src/core/defineCms';
import { memoryAdapter } from '../src/adapters/memory';
import { CmsField, CmsIcon, CmsProvider, CmsSection, useCollectionItem } from '../src/site';

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

  it('adds nothing for visitors around a record field, inside or outside a section', () => {
    const record = React.createElement(CmsField, { collection: 'blog', item: 'school', path: 'title' }, 'School');
    expect(renderToStaticMarkup(React.createElement(CmsProvider, { config }, record))).toBe('School');
    const inSection = React.createElement(CmsSection, { sectionKey: 'hero', title: 'Hero' }, record);
    expect(renderToStaticMarkup(React.createElement(CmsProvider, { config }, inSection))).toBe('School');
  });

  it('gives visitors the loaded record values unchanged', () => {
    const Show = () => React.createElement('b', null, useCollectionItem('blog', 'school', { title: 'School' }).title);
    expect(renderToStaticMarkup(React.createElement(CmsProvider, { config }, React.createElement(Show)))).toBe('<b>School</b>');
  });
});

describe('CmsIcon', () => {
  const Star = (props: { className?: string }) => React.createElement('svg', { 'data-icon': 'star', className: props.className });
  const withIcons = defineCms({ adapter: memoryAdapter(), pages: [], icons: { Star } });

  it('draws the named icon from the config, and nothing for unknown names', () => {
    const icon = React.createElement(CmsIcon, { name: 'Star', className: 'size-6' });
    expect(renderToStaticMarkup(React.createElement(CmsProvider, { config: withIcons }, icon))).toBe('<svg data-icon="star" class="size-6"></svg>');
    const unknown = React.createElement(CmsIcon, { name: 'Terminal' });
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      expect(renderToStaticMarkup(React.createElement(CmsProvider, { config: withIcons }, unknown))).toBe('');
    } finally {
      console.warn = warn;
    }
  });
});
