import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as admin from '../src/admin';
import { CmsStudio } from '../src/admin/CmsStudio';
import { defineCms } from '../src/core/defineCms';
import { memoryAdapter } from '../src/adapters/memory';

const config = defineCms({
  title: 'Test CMS',
  adapter: memoryAdapter(),
  pages: [
    { key: 'home', title: 'Home', route: '/', sections: [{ key: 'hero', label: 'Hero' }], defaults: { hero: { title: 'Hi' } } },
    { key: 'about', title: 'About', route: '/about', sections: [{ key: 'team', label: 'Team' }], defaults: { team: { title: 'Us' } } },
  ],
});

describe('CmsStudio', () => {
  const html = renderToStaticMarkup(React.createElement(CmsStudio, { config, toaster: false }));

  it('renders the live-preview editor with its toolbar', () => {
    expect(html).toContain('Test CMS');
    expect(html).toContain('Launch Live Preview');
    expect(html).toContain('Hover over any section in the live preview');
  });

  it('has no Form Studio and no editor-mode switch', () => {
    expect(html).not.toContain('Form Studio');
    expect(html).not.toContain('Visual Interactive Canvas');
    expect(html).not.toContain('Pick a section from the list and edit its fields.');
  });

  it('no longer exports a form studio', () => {
    expect(Object.keys(admin)).not.toContain('FormStudio');
  });
});
