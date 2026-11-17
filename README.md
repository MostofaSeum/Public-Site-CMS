# @brainicon/visual-cms

A visual CMS for React and Next.js sites. Add one admin page and your editors get:

- a list of every page of your site,
- a **live preview** of the real page, at desktop, tablet or mobile size,
- a **pencil "Edit" button** when they hover any section of the preview,
- a **form editor** for that section, built automatically from your content's JSON,
- changes shown in the preview **as they type**, then saved, published or reset to defaults.

Content is stored through a small adapter, so it works with any backend: a JSON file, a database, or your existing API.

## Requirements

- React 18 or 19
- Tailwind CSS v4 in the host app (the components are styled with Tailwind classes)
- Peer dependencies: `lucide-react`, `react-hot-toast` (and `next` if you use the `/next` helpers)

## Quickstart (Next.js App Router)

### 1. Install

```bash
npm install @brainicon/visual-cms lucide-react react-hot-toast
```

Let Tailwind see the package's class names, in your global CSS:

```css
@import "tailwindcss";
@source "../node_modules/@brainicon/visual-cms/dist";
```

### 2. Describe your pages

Each page has a key, a public route, its sections, and its default content. The defaults are what the site shows until someone edits a section.

```ts
// cms.config.ts
import { defineCms } from '@brainicon/visual-cms';
import { restAdapter } from '@brainicon/visual-cms/adapters';
import home from './content/home.json'; // { "hero": {...}, "features": {...} }

export const cms = defineCms({
  title: 'Site CMS',
  adapter: restAdapter({ baseUrl: '/api/cms' }),
  pages: [
    {
      key: 'home',
      title: 'Home',
      route: '/',
      defaults: home,
      sections: [
        { key: 'hero', label: 'Hero' },
        { key: 'features', label: 'Features' },
      ],
    },
  ],
});
```

### 3. Add the API route

```ts
// app/api/cms/[...path]/route.ts
import { createCmsRouteHandler, fileStorage } from '@brainicon/visual-cms/next';
import { cms } from '@/cms.config';

export const { GET, PUT, DELETE, POST } = createCmsRouteHandler({
  storage: fileStorage(), // .cms/content.json + public/cms-uploads
  allowedPages: cms.pages.map((p) => p.key),
  authorize: async (req) => (await getSession(req))?.role === 'admin', // your auth
});
```

### 4. Add the CMS page and the menu button

```tsx
// app/admin/cms/page.tsx
'use client';
import { CmsStudio } from '@brainicon/visual-cms/admin';
import { cms } from '@/cms.config';

export default function CmsPage() {
  return <CmsStudio config={cms} />;
}
```

In your admin sidebar:

```tsx
'use client';
import Link from 'next/link';
import { CmsNavButton } from '@brainicon/visual-cms/admin';

<CmsNavButton href="/admin/cms" as={Link} />
```

A library cannot add itself to an admin panel it doesn't know, so this one line is yours to place. A normal link works too.

### 5. Make your pages editable

Wrap the site in the provider (a client component):

```tsx
// components/Providers.tsx
'use client';
import { CmsProvider } from '@brainicon/visual-cms/site';
import { cms } from '@/cms.config';

export function Providers({ children }: { children: React.ReactNode }) {
  return <CmsProvider config={cms}>{children}</CmsProvider>;
}
```

Read content with `usePageContent` and wrap each block in `CmsSection`:

```tsx
'use client';
import { CmsSection, usePageContent } from '@brainicon/visual-cms/site';

export function HomeView({ initialData }) {
  const { hero } = usePageContent('home', { initialData });
  return (
    <CmsSection sectionKey="hero" title="Hero">
      <h1>{hero.title}</h1>
    </CmsSection>
  );
}
```

`CmsSection` renders nothing extra for visitors. The outline and edit button only appear inside the studio's preview.

For server rendering and SEO, load the content on the server and pass it down:

```tsx
// app/page.tsx
import { getPageContent, getPageMetadata } from '@brainicon/visual-cms/next';
import { storage } from '@/lib/storage'; // the same fileStorage() instance as the API route

export const generateMetadata = () => getPageMetadata(cms, 'home', { storage });

export default async function Page() {
  const content = await getPageContent(cms, 'home', { storage });
  return <HomeView initialData={content} />;
}
```

`getPageMetadata` reads an optional `seo` section (`title`, `description`, `keywords`, `canonical`, `ogTitle`, `ogDescription`, `ogImage`, `twitterCard`, `robots`).

A complete working app is in [examples/next-demo](examples/next-demo).

## How the form is built

There is no schema to write. The editor reads the section's JSON and picks a field for each value:

| Value | Field |
|---|---|
| string | text input (textarea when long or multi-line) |
| key named like `image`, `logo`, `avatar`, `src`… or an image URL | image picker (gallery, upload, URL) |
| key named like `icon`, `iconName`… | Lucide icon picker; render it with `getDynamicIcon(name)` |
| number / boolean | number input / checkbox |
| key `id` | shown read-only |
| array | list with add, delete and reorder |
| object | nested group |
| `{ html, css, js }` | your code editor, if you pass `widgets.code` |

Limit list lengths to protect a layout:

```ts
collectionLimits: { 'home.features.items': { max: 6, label: 'Feature cards' } }
```

## Configuration

| Option | Purpose |
|---|---|
| `pages` | Pages, routes, sections and defaults |
| `adapter` | Where content is read from and saved to |
| `title` | Studio heading |
| `publicSiteUrl` | Site base URL when the studio runs on another origin (e.g. `admin.example.com` editing `example.com`) |
| `allowedOrigins` | Extra origins allowed to exchange preview messages |
| `collectionLimits` | Maximum items per array field |
| `imagePresets`, `imagePresetCategories` | Ready-made images in the image picker |
| `widgets.code` | Component for editing `{ html, css, js }` values |
| `section.transform` | Normalise a section's data before it reaches the form |

## Storage

Storage only keeps **overrides**: a section that was never edited is not stored and shows its default. "Reset" deletes the override.

### Using Django as the backend

Install the companion package [`django-visual-cms`](django-visual-cms/README.md). It adds the model, the API and Django admin integration, and uses your Django logins. On the frontend, use `djangoAdapter`, which also handles Django's CSRF token. You then don't need the Next.js API route or `fileStorage`.

```ts
import { djangoAdapter } from '@brainicon/visual-cms/adapters';

adapter: djangoAdapter({ baseUrl: 'https://api.example.com/api/cms' }),
```

### REST contract

`restAdapter` talks to these endpoints, and `createCmsRouteHandler` implements them. Any backend (Django, Laravel, Express…) can implement them too:

| Method | Path | Body / result |
|---|---|---|
| GET | `/records?page=&drafts=1` | `SectionRecord[]` |
| GET | `/records/:page/:section?drafts=1` | `SectionRecord`, or `null` if never edited |
| PUT | `/records/:page/:section` | body `{ content, isPublished }` → `SectionRecord` |
| DELETE | `/records/:page/:section` | `204` |
| GET | `/media` | `MediaItem[]` |
| POST | `/media` | multipart `files` → `{ items: MediaItem[] }` |

```ts
type SectionRecord = { page: string; sectionKey: string; content: unknown;
  isPublished: boolean; updatedAt: string | null; updatedBy?: string | null };
type MediaItem = { url: string; name: string; size?: number };
```

Return drafts (`drafts=1`) only to authorised editors, and refuse writes from anyone else.

### Writing an adapter

Implement `CmsStorageAdapter` and pass it as `storage` to the route handler (server side) or directly as `adapter` (client side):

```ts
interface CmsStorageAdapter {
  listRecords(page?: string, options?: { includeDrafts?: boolean }): Promise<SectionRecord[]>;
  getRecord(page: string, sectionKey: string, options?: { includeDrafts?: boolean }): Promise<SectionRecord | null>;
  saveRecord(input: { page; sectionKey; content; isPublished; updatedBy? }): Promise<SectionRecord>;
  deleteRecord(page: string, sectionKey: string): Promise<void>;
  uploadMedia?(files: File[]): Promise<MediaItem[]>; // optional: enables uploads
  listMedia?(): Promise<MediaItem[]>;                // optional: enables the media library
}
```

`memoryAdapter()` (in `@brainicon/visual-cms/adapters`) is a short reference implementation.

`fileStorage()` suits local development and single-server deployments (VPS, Docker with a volume). It does **not** work on read-only or multi-instance hosts such as Vercel. Use a database-backed adapter there.

## Security

- The library has no login of its own. Protect your studio route, and implement `authorize` in the route handler.
- Visitors only ever receive published content. Drafts are returned only when `authorize` passes.
- Page and section keys are validated (`A–Z a–z 0–9 _ -`). Uploads are limited to image types and a size cap, and are saved under random names.
- Preview messages are sent only to the configured origins and are ignored from any other origin or window.

## Redirects and the preview iframe

If your middleware redirects some requests (to a login page, to an admin host, by locale), let the preview through:

```ts
import { isCmsPreviewRequest } from '@brainicon/visual-cms/next';

if (!isCmsPreviewRequest(request, { studioPath: '/admin/cms' })) {
  // ...your redirect
}
```

## Entry points

| Import | Contents |
|---|---|
| `@brainicon/visual-cms` | `defineCms`, types, merge helpers, message protocol |
| `@brainicon/visual-cms/site` | `CmsProvider`, `usePageContent`, `CmsSection`, `getDynamicIcon` |
| `@brainicon/visual-cms/admin` | `CmsStudio`, `CmsNavButton` |
| `@brainicon/visual-cms/adapters` | `restAdapter`, `djangoAdapter`, `memoryAdapter` |
| `@brainicon/visual-cms/next` | `createCmsRouteHandler`, `fileStorage`, `getPageContent`, `getPageMetadata`, `isCmsPreviewRequest` |

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack   # then install the .tgz into examples/next-demo
```

## License

MIT
