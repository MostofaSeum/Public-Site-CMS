/** Source text of the files `visual-cms init` creates. */

export type Backend = 'files' | 'django';

export function cmsConfig(opts: { backend: Backend; apiUrl: string; example: boolean; exampleJsonImport: string }): string {
  const adapterImport =
    opts.backend === 'django'
      ? "import { djangoAdapter } from '@brainicon/visual-cms/adapters';"
      : "import { restAdapter } from '@brainicon/visual-cms/adapters';";
  const adapter =
    opts.backend === 'django'
      ? `djangoAdapter({ baseUrl: '${opts.apiUrl}' }), // change for production`
      : "restAdapter({ baseUrl: '/api/cms' }),";

  const examplePage = `    {
      key: 'example',
      title: 'Example page',
      route: '/cms-example',
      defaults: example,
      sections: [
        { key: 'hero', label: '1. Hero' },
        { key: 'features', label: '2. Features' },
      ],
    },`;

  const noPages = `    // Add your pages here. For each page: a key, its public route, its sections,
    // and "defaults" (the content shown until someone edits a section).
    //
    // {
    //   key: 'home',
    //   title: 'Home',
    //   route: '/',
    //   defaults: homeContent,
    //   sections: [{ key: 'hero', label: 'Hero' }],
    // },`;

  return `import { defineCms } from '@brainicon/visual-cms';
${adapterImport}
${opts.example ? `import example from '${opts.exampleJsonImport}';\n` : ''}
export const cms = defineCms({
  title: 'Site CMS',
  adapter: ${adapter}
  pages: [
${opts.example ? examplePage : noPages}
  ],
});
`;
}

export const exampleContentJson = `{
  "hero": {
    "title": "Edit me from the CMS",
    "subtitle": "This example page shows how a page becomes editable.",
    "image": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200"
  },
  "features": {
    "title": "What you can change",
    "items": [
      { "id": "f1", "title": "Text", "text": "Edit any heading or paragraph." },
      { "id": "f2", "title": "Images", "text": "Pick or upload an image." },
      { "id": "f3", "title": "Lists", "text": "Add, remove and reorder items." }
    ]
  }
}
`;

export function filesStorage(): string {
  return `import { fileStorage } from '@brainicon/visual-cms/next';

// Edits are saved to .cms/content.json and uploads to public/cms-uploads.
// Fine for local development and a single server. On read-only or multi-instance
// hosts (for example Vercel) use a database-backed storage adapter instead.
export const storage = fileStorage();
`;
}

export function djangoStorage(cmsConfigImport: string): string {
  return `import { cms } from '${cmsConfigImport}';

// Server-side reads of published content go straight to Django through the same adapter.
export const storage = cms.adapter;
`;
}

export function apiRoute(opts: { storageImport: string; configImport: string }): string {
  return `import { createCmsRouteHandler } from '@brainicon/visual-cms/next';
import { storage } from '${opts.storageImport}';
import { cms } from '${opts.configImport}';

export const { GET, PUT, DELETE, POST } = createCmsRouteHandler({
  storage,
  allowedPages: cms.pages.map((p) => p.key),
  // TODO before deploying: replace this with a real check of your own login or session, e.g.
  //   authorize: async (req) => (await getSession(req))?.role === 'admin',
  // Until then, editing only works while running \`next dev\`.
  authorize: () => process.env.NODE_ENV === 'development',
});
`;
}

export function providers(configImport: string): string {
  return `'use client';

import { CmsProvider } from '@brainicon/visual-cms/site';
import { cms } from '${configImport}';

export function CmsProviders({ children }: { children: React.ReactNode }) {
  return <CmsProvider config={cms}>{children}</CmsProvider>;
}
`;
}

export function adminPage(configImport: string): string {
  return `'use client';

import { CmsStudio } from '@brainicon/visual-cms/admin';
import { cms } from '${configImport}';

export default function CmsPage() {
  return <CmsStudio config={cms} />;
}
`;
}

export function adminLayout(opts: { href: string }): string {
  return `'use client';

import Link from 'next/link';
import { CmsNavButton } from '@brainicon/visual-cms/admin';

// A minimal admin shell. If you already have an admin layout, delete this file and
// put the <CmsNavButton> line into your own menu instead.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="w-56 shrink-0 border-r border-slate-800 p-4">
        <div className="px-4 pb-4 font-bold text-white">Admin</div>
        <CmsNavButton href="${opts.href}" as={Link} active />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
`;
}

export function examplePage(opts: { configImport: string; storageImport: string; viewImport: string; jsonImport: string }): string {
  return `import { getPageContent } from '@brainicon/visual-cms/next';
import { cms } from '${opts.configImport}';
import { storage } from '${opts.storageImport}';
import { CmsExampleView } from '${opts.viewImport}';
import type example from '${opts.jsonImport}';

// Always read fresh content: it can change at any moment from the CMS.
export const dynamic = 'force-dynamic';

export default async function CmsExamplePage() {
  // Defaults from content/cms-example.json, overlaid by anything saved in the CMS.
  const content = await getPageContent<typeof example>(cms, 'example', { storage });
  return <CmsExampleView initialData={content} />;
}
`;
}

export function exampleView(jsonImport: string): string {
  return `'use client';

import { CmsSection, usePageContent } from '@brainicon/visual-cms/site';
import type example from '${jsonImport}';

type ExampleContent = typeof example;

/**
 * How a page becomes editable:
 *   1. its text lives in a content object (content/cms-example.json),
 *   2. usePageContent('<page key>') reads it,
 *   3. each editable block is wrapped in <CmsSection sectionKey="..." title="...">.
 */
export function CmsExampleView({ initialData }: { initialData: ExampleContent }) {
  const { hero, features } = usePageContent<ExampleContent>('example', { initialData });

  return (
    <main>
      <CmsSection sectionKey="hero" title="Hero">
        <section className="mx-auto grid max-w-5xl items-center gap-8 px-6 py-20 md:grid-cols-2">
          <div>
            <h1 className="text-5xl font-bold">{hero.title}</h1>
            <p className="mt-4 text-lg text-gray-600">{hero.subtitle}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.image} alt="" className="rounded-2xl" />
        </section>
      </CmsSection>

      <CmsSection sectionKey="features" title="Features">
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-6 text-3xl font-bold">{features.title}</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 p-6">
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </CmsSection>
    </main>
  );
}
`;
}
