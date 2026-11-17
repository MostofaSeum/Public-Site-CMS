# @brainicon/visual-cms

A visual CMS for React and Next.js sites. Add one page to your admin panel and your editors get:

- a list of every page of the site,
- a **live preview** of the real page, at desktop, tablet or mobile size,
- a **pencil "Edit" button** that appears when they hover any section of the preview,
- a **form editor** for that section, built automatically from the section's content,
- changes shown in the preview **as they type**, then saved, published, or reset to the default.

Content is stored through a small adapter, so it works with a JSON file, a database, Django, or your own API.

> **This is a local library.** You install it from this folder, not from npm. Everything below is written for that. Replace `<LIB>` in the commands with the absolute path of the folder that contains this README, and `<PROJECT>` with your website's folder.

## Contents

1. [Install](#1-install)
2. [Connect it to your admin panel](#2-connect-it-to-your-admin-panel)
3. [Install with an AI agent](#3-install-with-an-ai-agent)
4. [Make your own pages editable](#4-make-your-own-pages-editable)
5. [Before you go live](#5-before-you-go-live)
6. [Backends: files, Django, your own](#6-backends-files-django-your-own)
7. [Troubleshooting](#7-troubleshooting)
8. [Reference](#8-reference)
9. [Updating the local library](#9-updating-the-local-library)

---

## 1. Install

**Your project needs:** Next.js (App Router, version 14 or newer; tested on 15), TypeScript, Tailwind CSS v4, Node.js 18.18 or newer. For anything else, see [Other setups](#other-setups-manual).

### Step 1. Pack the library (once per library version)

```bash
cd <LIB>
npm install
npm pack
```

This creates `<LIB>/brainicon-visual-cms-0.1.0.tgz`. The version in the file name comes from `package.json`. `npm pack` builds the library for you.

### Step 2. Install it into your project

```bash
cd <PROJECT>
npm install "<LIB>/brainicon-visual-cms-0.1.0.tgz"
```

Windows example: `npm install "D:\Libraries\Public-Site-CMS\brainicon-visual-cms-0.1.0.tgz"`

> **Install the `.tgz`, not the folder.** `npm install <LIB>` links the folder instead of copying it, which can load a second copy of React and break the editor.

Check that it worked:

```bash
npx visual-cms --version     # prints 0.1.0
```

### Step 3. Run the setup command

```bash
npx visual-cms init
```

It asks up to four questions (where content is stored, the Django URL if you choose Django, the route of the CMS screen, and whether to create an example page). To skip the questions and accept the defaults: `npx visual-cms init --yes`. To see what it would do without changing anything: add `--dry-run`.

What it does for you:

| It creates | Purpose |
|---|---|
| `cms.config.ts` | the list of editable pages |
| `lib/cms-storage.ts` and `app/api/cms/[...path]/route.ts` | where edits are saved, and the API the CMS uses (file backend) |
| `components/CmsProviders.tsx` | the provider the CMS needs |
| `app/admin/cms/page.tsx` | the CMS screen |
| `app/admin/layout.tsx` | a small admin shell with the CMS button, **only if you have no admin area yet** |
| `app/cms-example/page.tsx`, `components/CmsExampleView.tsx`, `content/cms-example.json` | an example page that shows how a page becomes editable |

| It edits (small changes you can review in `git diff`) | Change |
|---|---|
| `app/layout.tsx` | wraps `{children}` with `<CmsProviders>` |
| the global CSS file | adds one Tailwind `@source` line so the CMS screens are styled |
| `.gitignore` | ignores `.cms` and `public/cms-uploads` (file backend) |

It also installs `lucide-react` and `react-hot-toast` if they are missing, using your package manager (npm, pnpm, yarn or bun, detected from your lockfile).

It is safe to run again. It never overwrites a file you already have (use `--force` to replace), and a second run changes nothing. Under `src/`, files go under `src/`.

### Step 4. Open the CMS

```bash
npm run dev
```

Open `http://localhost:3000/admin/cms`. Hover a section of the example page in the preview, click the pencil, change the text, and watch the preview update. **Save & Publish** puts it on the site. The reset button (circular arrow) goes back to the default.

### Step 5. Connect your admin panel

If you already have an admin panel, continue with [section 2](#2-connect-it-to-your-admin-panel). It takes two small edits.

### Try the demo app first (optional)

The repository includes a complete working app:

```bash
cd <LIB>
npm install && npm pack
cd examples/next-demo
npm install
npm run dev          # open http://localhost:3000/admin/cms
```

---

## 2. Connect it to your admin panel

The CMS is an ordinary page (`/admin/cms` by default) that renders `<CmsStudio />`. Connecting it to your admin panel means three things:

1. **The page lives inside your admin area**, so your login already protects it.
2. **Your admin menu links to it.**
3. **The API checks your login.**

| Your admin panel is… | Go to |
|---|---|
| none yet | [Case A](#case-a-no-admin-panel-yet) |
| part of this Next.js app | [Case B](#case-b-your-admin-panel-is-part-of-this-nextjs-app) |
| a different app or site (React, Vue, Laravel, Django templates, WordPress…) | [Case C](#case-c-your-admin-panel-is-a-different-app) |

### Case A: no admin panel yet

Nothing to do. `init` already created `app/admin/layout.tsx` with a sidebar that has the CMS button, and the page at `/admin/cms`. When you build your real admin panel later, delete that layout and add the button to your own menu (Case B, step 3).

You still must protect it before going live: [Before you go live](#5-before-you-go-live).

### Case B: your admin panel is part of this Next.js app

**Step 1. Find your admin area's folder under `app/`.** Examples: `app/admin`, `app/dashboard`, `app/(dashboard)/dashboard`. It usually has a `layout.tsx` that checks the login, or a `middleware.ts` guards it.

**Step 2. Create the CMS page inside that folder.** Run `init` with the folder plus `/cms`:

```bash
npx visual-cms init --admin-path admin/cms
npx visual-cms init --admin-path dashboard/cms
npx visual-cms init --admin-path "(dashboard)/dashboard/cms"     # quotes are required for parentheses
```

A folder in parentheses is a Next.js *route group*: it is part of the path on disk but not of the URL. `init` handles this, so the last example creates `app/(dashboard)/dashboard/cms/page.tsx` and the URL is `/dashboard/cms`. Because your existing admin folder is there, `init` leaves your layout alone, and the new page automatically gets your layout and your login guard.

> If you already ran `init` with the default path, delete the files it created for the wrong location (`app/admin/cms/` and, if `init` made it, `app/admin/layout.tsx`) before running it again with the right path. Run `init --dry-run` first if unsure.

**Step 3. Add the CMS link to your admin menu.** Find the file that renders the menu (search your admin folder for the labels of your existing menu items).

If the menu is JSX links, add the ready-made button. Pass your menu's own `className` so it matches:

```tsx
'use client';
import Link from 'next/link';
import { CmsNavButton } from '@brainicon/visual-cms/admin';

<CmsNavButton href="/admin/cms" as={Link} className="your-menu-item-classes" />
```

If the menu is a list of objects, just add an item. A plain link is enough:

```tsx
{ label: 'CMS', href: '/admin/cms', icon: Globe }
```

If your menu file is a Server Component, leave out `as={Link}` (a normal link works) or add `'use client'` at the top of the file. Use the URL `init` printed, not the folder path (for the route-group example it is `/dashboard/cms`).

**Step 4. Give the API your login check.** The API route is outside your admin folder, so it needs its own check. Open `app/api/cms/[...path]/route.ts` and replace the generated `authorize` (it only allows editing under `next dev`):

```ts
authorize: async () => {
  const user = await getCurrentUser();   // use the same function your admin pages use
  return user?.role === 'admin';         // use the same rule your admin pages use
},
```

`authorize` receives the request (`(request: Request) => boolean | Promise<boolean>`) if your auth needs headers. After this change, editing in `next dev` requires being logged in too.

**Step 5.** If you have a `middleware.ts` that redirects visitors, see [Redirects and the preview iframe](#redirects-and-the-preview-iframe).

### Case C: your admin panel is a different app

**Recommended: keep the CMS screen in this Next.js site and link to it from your admin panel.** It works with any admin technology.

1. Run `npx visual-cms init` in the Next.js site (Case A).
2. In your other admin panel's menu, add a link that opens the CMS page, for example `https://your-site.com/admin/cms`. Editors can open it in a new tab.
3. Make sure editors are signed in on the site: replace `authorize` as in Case B step 4, using whatever login the site understands (a shared cookie, a token, or a separate login).

**Advanced (not tested end to end): the screen inside a React admin app on another domain.** You would render `<CmsStudio config={cms} />` in that app with `publicSiteUrl` set to the site's URL, add the admin's origin to `allowedOrigins` in the site's config, enable CORS on the site's API, send your auth with `restAdapter({ headers })`, and make sure the site may be shown in an iframe by the admin's origin (no `X-Frame-Options: DENY`, no restrictive `frame-ancestors`). The link approach above avoids all of this.

---

## 3. Install with an AI agent

You can hand this to an AI coding agent (Claude Code, Cursor, Copilot, Codex, and similar). After the library is installed, this README is also at `node_modules/@brainicon/visual-cms/README.md`.

### Prompt to give your agent

```text
Install and connect the visual CMS library in this project.

Library folder: <LIB>
Read <LIB>/README.md, section "3. Install with an AI agent", and follow it exactly.

Backend: files            (or: django, API URL https://...)
Admin panel: find it      (or: it is at app/dashboard, or: none yet)
```

The short version also works: "Install the visual CMS from `<LIB>` and connect it to my admin panel."

### Instructions for the agent

**Rules**

1. Run `npx visual-cms init`. Do not hand-write the files it generates.
2. Always pass `--yes` (no interactive questions), and run `--dry-run` once first.
3. Install the library from the packed `.tgz`, never from the folder path (see [Step 2](#step-2-install-it-into-your-project)).
4. Do not edit anything inside `node_modules`.
5. Never leave editing open to everyone. The generated `authorize()` only allows editing under `next dev`. Replace it with the project's real login check. If you cannot work out the project's login, leave the generated check as it is and tell the developer.
6. Do not commit `.cms/` or `public/cms-uploads/` (init already adds them to `.gitignore`).
7. Check the result of every step before the next one. If a check fails, use [Troubleshooting](#7-troubleshooting). Do not guess.
8. Ask the developer only for inputs you cannot find yourself.

**Inputs**

| Name | Meaning | How to get it |
|---|---|---|
| `LIB` | absolute path of the library folder | the developer gave it; it contains this README and `package.json` named `@brainicon/visual-cms` |
| `PROJECT` | the website's root folder | the folder with the `package.json` that lists `next` |
| `BACKEND` | `files` (default) or `django` | ask if the project has a Django API for content; otherwise `files` |
| `API_URL` | Django API base URL, `django` only | ask; default `http://localhost:8000/api/cms` |
| `ADMIN_AREA` | the admin folder under `app/`, route groups included, e.g. `dashboard` or `(dashboard)/dashboard` | Step 2 |
| `ADMIN_URL` | the URL of the CMS screen `init` will create, e.g. `/dashboard/cms` (the admin folder without route groups, plus `/cms`) | Step 2 |
| `MENU_FILE` | file that renders the admin menu | Step 2 |
| `AUTH_FN` | what the admin pages use to decide who may enter | Step 2 |

**Step 1. Check the project.** Run these in `PROJECT`:

| Check | Pass when | If it fails |
|---|---|---|
| `node -v` | 18.18 or newer | tell the developer to upgrade Node |
| `node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};console.log(d.next,d.tailwindcss)"` | prints a Next.js version and a Tailwind version starting with 4 (`^4`, `4.1.0`…) | not Next.js: use [Other setups](#other-setups-manual) or stop. Tailwind below 4 or missing: tell the developer, since the CMS screens need v4 |
| `app/` or `src/app/` exists | yes | Pages Router only: not supported by `init`; tell the developer |
| `tsconfig.json` exists | yes | JavaScript-only: not supported by `init`; tell the developer |
| `git status` | tells you what is uncommitted | note it. `init` makes small edits, so it is fine to continue, but mention it |

**Step 2. Find the admin panel.** Decide which case applies:

- List the folders under `app/` (or `src/app/`) and look for `admin`, `dashboard`, `manage`, `backoffice`, or a route group like `(admin)`. Open its `layout.tsx` and any `middleware.ts`. Note the login check they use: that is `AUTH_FN`.
- Search that folder for the file that renders the menu: grep for the labels of existing menu items ("Dashboard", "Users", "Settings") or for components named `Sidebar`, `Nav`, `Menu`. That is `MENU_FILE`.
- Result: **NO_ADMIN** (nothing found: [Case A](#case-a-no-admin-panel-yet)), **NEXT_ADMIN** (found in this app: [Case B](#case-b-your-admin-panel-is-part-of-this-nextjs-app)), or **EXTERNAL_ADMIN** (the admin is another app: [Case C](#case-c-your-admin-panel-is-a-different-app)).
- If you are unsure which case applies, ask the developer one question: "Where is your admin panel?"

**Step 3. Pack and install the library.**

```bash
cd <LIB> && npm install && npm pack
cd <PROJECT> && npm install "<LIB>/brainicon-visual-cms-<version>.tgz"
npx visual-cms --version
```

Use the real `.tgz` file name that `npm pack` printed. Pass when the last command prints a version. If `<LIB>/brainicon-visual-cms-<version>.tgz` already exists and the library has not changed, skip the first line.

**Step 4. Run `init`.** Build the command from the inputs, run it with `--dry-run` first, read the plan, then run it for real:

| Situation | Command |
|---|---|
| NO_ADMIN or EXTERNAL_ADMIN, files backend | `npx visual-cms init --yes` |
| NEXT_ADMIN, files backend | `npx visual-cms init --yes --admin-path "<ADMIN_AREA>/cms"` |
| Django backend | add `--backend django --api-url <API_URL>` |
| Developer does not want the example page | add `--no-example` |
| Package install must be skipped | add `--no-install` and install `lucide-react react-hot-toast` yourself |

Pass when the command exits with code 0 and lists created and modified files. **Every line under "Warnings" and "Still to do by hand" in its output is a task for you:** do it, or report it to the developer.

**Step 5. Connect the admin panel.**

- **NO_ADMIN:** nothing to do.
- **NEXT_ADMIN:** do [Case B](#case-b-your-admin-panel-is-part-of-this-nextjs-app) steps 3 and 4: add the link to `MENU_FILE` in the menu's own style, and replace `authorize` using `AUTH_FN`.
- **EXTERNAL_ADMIN:** do [Case C](#case-c-your-admin-panel-is-a-different-app): add a link to the CMS page in the other admin, and replace `authorize` with a check the site can perform.
- **Django backend:** also do the Django-side steps that `init` printed ([section 6](#using-django)).

**Step 6. Verify.** Pass only when all of these hold (the dev server uses port 3000 unless the project says otherwise; `<ADMIN_URL>` is the CMS screen's URL, `/admin/cms` by default):

```bash
npx tsc --noEmit                      # exit code 0 (or: npm run build)
npm run dev                           # start it in the background, wait until it is ready
curl -s "http://localhost:3000/api/cms/records?page=example"      # prints []  (files backend)
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/cms-example"     # 200
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000<ADMIN_URL>"   # 200, or a redirect to the login page when the admin is protected. Not 404.
```

If `authorize` is still the generated dev-only check, also prove that saving works, then clean up:

```bash
curl -s -X PUT http://localhost:3000/api/cms/records/example/hero -H "Content-Type: application/json" -d "{\"content\":{\"title\":\"test\",\"subtitle\":\"s\",\"image\":\"\"},\"isPublished\":true}"
curl -s -X DELETE http://localhost:3000/api/cms/records/example/hero -o /dev/null -w "%{http_code}"     # 204
```

If you have a browser tool: open the CMS URL (log in first if required), confirm the preview loads, hover the "Features" block of the example page, and confirm the pencil button appears. Stop the dev server you started.

**Step 7. Report to the developer.** Say what was created and edited (the file list from `init`), the CMS URL, where the menu link was added, and what is still theirs to do: replace the dev-only `authorize()` if you could not, and use a database-backed storage before deploying to a serverless host ([Before you go live](#5-before-you-go-live)). Offer to make their real pages editable ([section 4](#4-make-your-own-pages-editable)).

**Common mistakes to avoid**

- Installing from the folder (`npm install <LIB>`) instead of the `.tgz`.
- Running `init` without `--yes` (it can wait for input that never comes).
- Running `init` with the default `--admin-path` when the real admin is elsewhere, which puts the CMS page outside the login guard.
- Forgetting that `--admin-path` must be quoted when it contains parentheses.
- Removing `authorize` or making it always return `true`.
- Wrapping a section in `<CmsSection sectionKey="x">` without adding `x` to that page's `sections` in `cms.config.ts`.

---

## 4. Make your own pages editable

`init` sets up the CMS. Making *your* pages editable is the part you do for each page, using the generated example as the pattern. Three steps.

**1. Put the page's text and images in a content object.** One top-level key per editable block:

```json
// content/home.json
{
  "hero": { "title": "Welcome", "subtitle": "…", "image": "/hero.jpg" },
  "features": { "title": "Why us", "items": [ { "id": "f1", "title": "Fast", "text": "…" } ] }
}
```

**2. Register the page in `cms.config.ts`:**

```ts
import home from './content/home.json';

pages: [
  {
    key: 'home',            // unique id used in storage
    title: 'Home',          // shown in the CMS
    route: '/',             // the public URL shown in the preview
    defaults: home,         // what the page shows until someone edits a section
    sections: [
      { key: 'hero', label: 'Hero' },        // key = a top-level key of the content
      { key: 'features', label: 'Features' },
    ],
  },
],
```

**3. Read the content and wrap each block.** The server loads content so the page has no flash and search engines see it; a client component renders it:

```tsx
// app/page.tsx  (server)
import { getPageContent } from '@brainicon/visual-cms/next';
import { cms } from '@/cms.config';
import { storage } from '@/lib/cms-storage';
import { HomeView } from '@/components/HomeView';
import type home from '@/content/home.json';

export const dynamic = 'force-dynamic';   // always show the latest edits

export default async function Page() {
  const content = await getPageContent<typeof home>(cms, 'home', { storage });
  return <HomeView initialData={content} />;
}
```

```tsx
// components/HomeView.tsx  (client)
'use client';
import { CmsSection, usePageContent } from '@brainicon/visual-cms/site';
import type home from '@/content/home.json';

export function HomeView({ initialData }: { initialData: typeof home }) {
  const { hero, features } = usePageContent<typeof home>('home', { initialData });
  return (
    <main>
      <CmsSection sectionKey="hero" title="Hero">
        <h1>{hero.title}</h1>
      </CmsSection>
      <CmsSection sectionKey="features" title="Features">
        {features.items.map((item) => <p key={item.id}>{item.title}</p>)}
      </CmsSection>
    </main>
  );
}
```

Tips:

- `CmsSection` adds nothing for visitors. The outline and pencil only appear inside the CMS preview.
- Each `sectionKey` must match a `key` in that page's `sections`.
- Give list items an `id`. Name image fields like `image`, `logo`, `avatar` or `src` to get the image picker, and icon fields like `icon` to get the icon picker (render with `getDynamicIcon(name)`).
- For sticky headers or banners, use `<CmsSection buttonPlacement="fixed">` so the pencil is not hidden.
- To let editors control the page's SEO, add a `seo` section (`title`, `description`, `keywords`, `canonical`, `ogTitle`, `ogDescription`, `ogImage`, `twitterCard`, `robots`) and use `getPageMetadata(cms, 'home', { storage })` in `generateMetadata`.
- With the Django backend, use `import { storage } from '@/lib/cms-storage'` the same way; `init` already generates it for Django.

---

## 5. Before you go live

- [ ] **Replace the dev-only `authorize()`** in `app/api/cms/[...path]/route.ts` with your real login check. Until then, editing works only under `next dev`, so a deployed site cannot be edited at all.
- [ ] **Protect the CMS page.** Keep it inside your admin area, behind the same guard as your other admin pages.
- [ ] **Check where content is stored.** `fileStorage()` writes `.cms/content.json` and `public/cms-uploads/`. That needs a disk that is writable and persistent: a VPS, or Docker with a volume. On Vercel or other serverless/read-only hosts the edits are lost, so use Django or a database-backed adapter.
- [ ] **Back up** `.cms/` and `public/cms-uploads/` if you use file storage. They are in `.gitignore`.
- [ ] **Edited pages must not be cached forever.** The generated pages use `export const dynamic = 'force-dynamic'`. Do the same for your pages, or use revalidation.
- [ ] **Middleware.** If it redirects visitors, let the preview through ([below](#redirects-and-the-preview-iframe)).
- [ ] **Django:** set CORS, CSRF and cookie options if the site and API are on different domains ([django-visual-cms/README.md](django-visual-cms/README.md)).

---

## 6. Backends: files, Django, your own

Storage keeps only **overrides**: a section nobody edited is not stored and shows its default. "Reset" deletes the override.

### Files (default)

`init` sets this up. Edits go to `.cms/content.json`, uploads to `public/cms-uploads/`. Fine for development and a single server.

### Using Django

Django keeps the content in its database and uses your Django logins. Two parts:

**1. The Django package** (from the library folder):

```bash
pip install "<LIB>/django-visual-cms"
```

In `settings.py` add `"visual_cms"` to `INSTALLED_APPS`. In the root `urls.py` add `path("api/cms/", include("visual_cms.urls"))`. Then run `python manage.py migrate`. By default any logged-in staff user can edit. Details, settings and CORS: [django-visual-cms/README.md](django-visual-cms/README.md).

**2. The frontend:**

```bash
npx visual-cms init --backend django --api-url https://api.example.com/api/cms
```

This generates `cms.config.ts` with `djangoAdapter`, which sends the Django session cookie and handles Django's CSRF token. No Next.js API route or `fileStorage` is created.

### Your own backend

Any server that implements these endpoints works with `restAdapter({ baseUrl })`:

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

Return drafts (`drafts=1`) only to authorised editors, and refuse writes from anyone else. To keep content in your own database from Next.js, implement `CmsStorageAdapter` and pass it as `storage` to `createCmsRouteHandler`:

```ts
interface CmsStorageAdapter {
  listRecords(page?: string, options?: { includeDrafts?: boolean }): Promise<SectionRecord[]>;
  getRecord(page: string, sectionKey: string, options?: { includeDrafts?: boolean }): Promise<SectionRecord | null>;
  saveRecord(input: { page; sectionKey; content; isPublished; updatedBy? }): Promise<SectionRecord>;
  deleteRecord(page: string, sectionKey: string): Promise<void>;
  uploadMedia?(files: File[]): Promise<MediaItem[]>;   // optional: enables uploads
  listMedia?(): Promise<MediaItem[]>;                  // optional: enables the media library
}
```

`memoryAdapter()` (in `@brainicon/visual-cms/adapters`) is a short reference implementation.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npx visual-cms` tries to download something, or says not found | the library is not installed in this project, or you are in the wrong folder | run `npm install "<LIB>/brainicon-visual-cms-<version>.tgz"` in the project root, then retry |
| "Invalid hook call", or `Cannot read properties of null (reading 'useState')` | two copies of React, usually from installing the folder instead of the `.tgz` | remove `node_modules/@brainicon`, install the `.tgz` ([section 9](#9-updating-the-local-library)) |
| the CMS screen has no styling | the Tailwind `@source` line is missing or points to the wrong place, or Tailwind is v3 | open the CSS file your root layout imports; it must contain `@source "…/node_modules/@brainicon/visual-cms/dist";` below `@import "tailwindcss";` |
| the preview shows "Loading…" forever, or is blank | the page's `route` in `cms.config.ts` is wrong, the page throws an error, a redirect catches the preview, or the site blocks being framed | open the route in a normal tab; check `middleware.ts` ([below](#redirects-and-the-preview-iframe)); remove `X-Frame-Options: DENY` |
| hovering shows no pencil | the block is not wrapped in `<CmsSection>`, `CmsProviders` is missing from the root layout, or Edit Mode is off | wrap the block; check `app/layout.tsx`; turn Edit Mode on in the toolbar |
| clicking the pencil says "Section '…' is not configured for this page" | the `sectionKey` is not in that page's `sections` | add `{ key: '…', label: '…' }` to the page in `cms.config.ts` |
| saving fails with 401 | `authorize()` returned false. The generated one allows editing only under `next dev` | implement your login check ([Case B step 4](#case-b-your-admin-panel-is-part-of-this-nextjs-app)); log in |
| saving fails with 404 "Unknown page" | the page key is not in `cms.config.ts` `pages` | register the page |
| saved edits do not show on the site | the page is cached, or it was saved as a draft | add `export const dynamic = 'force-dynamic'`; use **Save & Publish** |
| edits vanish after a deploy | file storage on a host with a temporary disk | use Django or a database adapter ([section 5](#5-before-you-go-live)) |
| TypeScript error importing a `.json` file | `resolveJsonModule` is off | set `"resolveJsonModule": true` in `tsconfig.json` |
| `Module not found: @brainicon/visual-cms/...` | the library is not installed, or the install is stale | reinstall the `.tgz`, delete `.next`, restart |
| `init` says "not a Next.js project", "Pages Router only" or "needs a TypeScript project" | unsupported project type | follow [Other setups](#other-setups-manual) |
| Django: 403 on save | missing or stale CSRF token | use `djangoAdapter` (not `restAdapter`) and see the CORS/CSRF settings in the Django README |
| `.tgz` not found | `npm pack` was not run, or the version changed | run `npm pack` in `<LIB>` and use the file name it prints |

---

## 8. Reference

### `visual-cms init` options

| Option | Meaning |
|---|---|
| `--backend files\|django` | where content is stored (default `files`) |
| `--api-url <url>` | Django API base URL (default `http://localhost:8000/api/cms`) |
| `--admin-path <path>` | folder of the CMS screen under `app/` (default `admin/cms`). Route groups are allowed: `"(admin)/dashboard/cms"` |
| `--no-example` | skip the example page |
| `--no-install` | do not install dependencies |
| `--dry-run` | show what would happen, change nothing |
| `--force` | overwrite existing files that differ |
| `-y, --yes` | accept defaults, ask nothing |
| `--cwd <dir>` | project folder (default: current folder) |
| `-h, --help`, `-v, --version` | help, version |

`init` supports the Next.js App Router with TypeScript and Tailwind v4. It stops with a clear message for the Pages Router and JavaScript-only projects, and leaves a manual step for Tailwind v3. It was tested with npm; pnpm, yarn and bun are detected from the lockfile but were not tested.

### Other setups (manual)

For a project `init` does not support, or if you prefer to do it by hand. This is what `init` generates.

**1.** Install the library ([Step 2](#step-2-install-it-into-your-project)) and `npm install lucide-react react-hot-toast`. In your global CSS, below `@import "tailwindcss";`, add `@source "../node_modules/@brainicon/visual-cms/dist";` (the path is relative to the CSS file).

**2.** `cms.config.ts`:

```ts
import { defineCms } from '@brainicon/visual-cms';
import { restAdapter } from '@brainicon/visual-cms/adapters';
import home from './content/home.json';

export const cms = defineCms({
  title: 'Site CMS',
  adapter: restAdapter({ baseUrl: '/api/cms' }),
  pages: [{ key: 'home', title: 'Home', route: '/', defaults: home,
            sections: [{ key: 'hero', label: 'Hero' }] }],
});
```

**3.** `lib/cms-storage.ts` and `app/api/cms/[...path]/route.ts`:

```ts
// lib/cms-storage.ts
import { fileStorage } from '@brainicon/visual-cms/next';
export const storage = fileStorage();
```

```ts
// app/api/cms/[...path]/route.ts
import { createCmsRouteHandler } from '@brainicon/visual-cms/next';
import { storage } from '@/lib/cms-storage';
import { cms } from '@/cms.config';

export const { GET, PUT, DELETE, POST } = createCmsRouteHandler({
  storage,
  allowedPages: cms.pages.map((p) => p.key),
  authorize: async (req) => /* your login check */ false,
});
```

**4.** The provider, wrapped around `{children}` in `app/layout.tsx`:

```tsx
// components/CmsProviders.tsx
'use client';
import { CmsProvider } from '@brainicon/visual-cms/site';
import { cms } from '@/cms.config';

export function CmsProviders({ children }: { children: React.ReactNode }) {
  return <CmsProvider config={cms}>{children}</CmsProvider>;
}
```

**5.** The CMS screen, and a link to it in your admin menu:

```tsx
// app/admin/cms/page.tsx
'use client';
import { CmsStudio } from '@brainicon/visual-cms/admin';
import { cms } from '@/cms.config';

export default function CmsPage() {
  return <CmsStudio config={cms} />;
}
```

### How the form is built

There is no schema to write. The editor reads the section's content and picks a field for each value:

| Value | Field |
|---|---|
| string | text input (textarea when long or multi-line) |
| key named like `image`, `logo`, `avatar`, `src`… or an image URL | image picker (gallery, upload, URL) |
| key named like `icon`, `iconName`… | Lucide icon picker |
| number / boolean | number input / checkbox |
| key `id` | shown read-only |
| array | list with add, delete and reorder |
| object | nested group |
| `{ html, css, js }` | your code editor, if you pass `widgets.code`; otherwise text areas |

### Configuration (`defineCms`)

| Option | Purpose |
|---|---|
| `pages` | pages, routes, sections and defaults |
| `adapter` | where content is read from and saved to |
| `title` | heading of the CMS screen |
| `publicSiteUrl` | site base URL when the CMS runs on another origin |
| `allowedOrigins` | extra origins allowed to exchange preview messages |
| `collectionLimits` | maximum items per list, e.g. `{ 'home.features.items': { max: 6, label: 'Feature cards' } }` |
| `imagePresets`, `imagePresetCategories` | ready-made images in the image picker |
| `widgets.code` | component for editing `{ html, css, js }` values |
| `sections[].transform` | normalise a section's data before it reaches the form |

### Components and functions

| Name | From | Use |
|---|---|---|
| `<CmsStudio config initialPage? defaultMode? toaster? />` | `/admin` | the CMS screen |
| `<CmsNavButton href active? label? as? className? />` | `/admin` | menu button for the CMS |
| `<CmsProvider config>` | `/site` | wrap the site once (root layout) |
| `usePageContent(pageKey, { initialData? })` | `/site` | read a page's content, with live preview in the CMS |
| `<CmsSection sectionKey title activeOnPath? buttonPlacement?>` | `/site` | make a block editable |
| `getDynamicIcon(name)` | `/site` | render an icon chosen in the icon picker |
| `getPageContent(config, pageKey, { storage })` | `/next` | load a page's content on the server |
| `getPageMetadata(config, pageKey, { storage, fallback? })` | `/next` | build Next.js metadata from the `seo` section |
| `createCmsRouteHandler({ storage, authorize, … })` | `/next` | the API route |
| `fileStorage()` | `/next` | JSON-file storage |
| `isCmsPreviewRequest(request, { studioPath? })` | `/next` | let the preview through middleware |
| `restAdapter`, `djangoAdapter`, `memoryAdapter` | `/adapters` | storage adapters for the browser |
| `defineCms`, types, merge helpers | `@brainicon/visual-cms` | configuration and types |

All imports are `@brainicon/visual-cms` plus the path shown (for example `@brainicon/visual-cms/admin`).

### Security

- The library has no login of its own. Protect the CMS page with your admin guard, and implement `authorize` on the API.
- Visitors only ever receive published content. Drafts are returned only when `authorize` passes.
- Page and section keys are validated (`A–Z a–z 0–9 _ -`). Uploads are limited to image types (no SVG by default) and a size cap, and are saved under random names.
- Preview messages are sent only to the configured origins and are ignored from any other origin or window.

### Redirects and the preview iframe

The CMS shows your real pages in an iframe. If your `middleware.ts` redirects some requests (to a login page, an admin host, or by locale), let the preview through:

```ts
import { isCmsPreviewRequest } from '@brainicon/visual-cms/next';

if (!isCmsPreviewRequest(request, { studioPath: '/admin/cms' })) {
  // ...your redirect
}
```

---

## 9. Updating the local library

After you change the library's code, pack it again and reinstall it in each project:

```bash
cd <LIB>
npm pack

cd <PROJECT>
rm -rf node_modules/@brainicon                  # PowerShell: Remove-Item -Recurse -Force node_modules\@brainicon
npm install "<LIB>/brainicon-visual-cms-<version>.tgz"
rm -rf .next                                    # then restart the dev server
```

Delete `node_modules/@brainicon` first: npm keeps the old copy when the version number has not changed. Bumping `version` in `<LIB>/package.json` also works.

### Development

```bash
cd <LIB>
npm install
npm run typecheck
npm test
npm run build
```

The Django package has its own tests: `cd django-visual-cms && python -m django test tests --settings=tests.settings` (set `PYTHONPATH=.` first).

## License

MIT
