# @brainicon/visual-cms

A visual CMS for Next.js sites (with an optional Django backend). Add one page to your admin panel and your editors get:

- a list of every page of the site,
- a **live preview** of the real page, at desktop, tablet or mobile size,
- a **pencil "Edit" button** that appears when they hover any section of the preview,
- a **form editor** for that section, built automatically from the section's content,
- changes shown in the preview **as they type**, then saved, published, or reset to the default.

Content is stored through a small adapter, so it works with a JSON file, Django, a database, or your own API. Editors never see JSON: they use forms.

## Let your AI agent do it

Click the **copy** button at the top right of the box below, paste it into your AI coding agent (Claude Code, Cursor, Copilot, Codex…) inside your project, and it will install the library, connect it to your admin panel, and make your pages editable, step by step, without breaking your code.

```text
Install and set up the visual CMS library @brainicon/visual-cms in this project, then make the website's pages editable from the admin panel.

Library: https://github.com/MostofaSeum/Public-Site-CMS
Full instructions: read the README in that repository (after installing it is also at node_modules/@brainicon/visual-cms/README.md), especially section "3. Install with an AI agent". Follow it exactly.

Safety rules (most important):
1. Before changing anything run `git status`. If there are uncommitted changes, ask me whether to commit them first. Then create a new branch named "visual-cms-setup" and do all work there.
2. Never delete, rename or rewrite code you were not asked to change. Visitors must see exactly the same website after the setup as before.
3. Run every visual-cms command with --dry-run first, read what it will change, then run it for real.
4. After every step run the project's type check (npx tsc --noEmit) or build. If it fails, fix the cause or undo that step (git checkout -- <file>, or restore the *.visual-cms.bak copy) before continuing.
5. Do not edit anything inside node_modules. Do not commit .cms/ or public/cms-uploads/.
6. Ask me only for things you cannot find out yourself.

Steps:
1. Check the project: Next.js App Router (app/ or src/app/), TypeScript, Tailwind CSS v4, Node 18.18+. Find the admin panel (folders like admin, dashboard, or a route group like (admin)), and find out whether there is a Django backend (a folder with manage.py).
2. Install: npm install github:MostofaSeum/Public-Site-CMS#v0.2.0   then check: npx visual-cms --version
3. Set it up with `npx visual-cms init --yes`:
   - with Django: add --django-dir <folder with manage.py> (and --api-url / --frontend-origin if the ports are not 8000 / 3000). This also sets up Django: package, settings, urls, CORS, migration.
   - if the admin panel lives under app/, add --admin-path "<admin folder>/cms" so the CMS screen sits behind the admin login.
   - if next.config has cacheComponents: true, add --no-example.
   Do every task listed under "Warnings" and "Still to do by hand" in its output.
4. Add a link to the CMS screen in the admin panel's menu, in the same style as the other menu items.
5. Make the pages editable, one page at a time, starting with the homepage:
   - npx visual-cms scan <page file> --dry-run   then review the list of texts it will move, then run it without --dry-run.
   - If scan says the file is a Server Component: if the page has no server-only code (not async, no metadata export, no database/fs/server imports) re-run with --add-use-client; otherwise move the page's JSX into a new client component file (components/<Name>View.tsx with 'use client'), render it from the page, and scan that file with --page <key> --route <url>.
   - Review the change with git diff and run the type check. The page must render exactly as before.
   - Optional: where scan turned hand-written repeated cards into separate fields, you may turn them into an array in the JSON plus a .map() in the code, so editors can add and remove items. Keep the output identical.
6. Run npx visual-cms doctor and fix every FAIL.
7. Start the dev server and open the CMS screen. With Django, log in first at http://localhost:8000/admin/ as a staff user (use localhost, not 127.0.0.1). Hover a section, click the pencil, change a text, Save & Publish, and check the public page shows it. Then reset it.
8. Report to me: what was installed, every file created or edited, the CMS URL, which pages are editable, and anything I still have to do (for example the real login check for saving, or a production database).
```

## Contents

1. [Install](#1-install)
2. [Connect it to your admin panel](#2-connect-it-to-your-admin-panel)
3. [Install with an AI agent](#3-install-with-an-ai-agent)
4. [Make your own pages editable](#4-make-your-own-pages-editable)
5. [Before you go live](#5-before-you-go-live)
6. [Backends: files, Django, your own](#6-backends-files-django-your-own)
7. [Troubleshooting](#7-troubleshooting)
8. [Reference](#8-reference)
9. [Updating](#9-updating)

---

## 1. Install

**Your project needs:** Next.js (App Router, version 14 or newer; tested on 15 and 16), TypeScript, Tailwind CSS v4, Node.js 18.18 or newer, and `git` (npm uses it to download the library from GitHub). For anything else, see [Other setups](#other-setups-manual).

### Step 1. Install the library from GitHub

In your Next.js project:

```bash
npm install github:MostofaSeum/Public-Site-CMS#v0.2.0
```

`#v0.2.0` pins a released version (see the repository's tags). The package keeps its name, so you import it as `@brainicon/visual-cms`. Check that it worked:

```bash
npx visual-cms --version     # prints 0.2.0
```

### Step 2. Run the setup command

```bash
npx visual-cms init
```

It asks up to five questions (where content is stored, the Django URL and folder if you choose Django, the route of the CMS screen, and whether to create an example page). To skip the questions and accept the defaults: `npx visual-cms init --yes`. To see what it would do without changing anything: add `--dry-run`.

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

> **Next.js 16 with `cacheComponents: true`:** add `--no-example`. The example page uses `export const dynamic`, which that mode does not allow.

**Using Django as the backend?** One command sets up both sides. Point it at the folder that contains `manage.py`:

```bash
npx visual-cms init --django-dir ../backend --frontend-origin http://localhost:3000
```

Besides the Next.js files above, this installs `django-visual-cms` (shipped inside the package) into your Django project's virtual environment (found as `venv`, `.venv` or `env` next to or inside that folder, otherwise the `python` on your PATH), then edits `settings.py` and `urls.py`, sets up CORS and runs the migration. Details are in [section 6](#using-django). Add `--dry-run` first to see everything it would change.

### Step 3. Make your pages editable

Convert an existing page in one command. It moves the page's texts into `content/<page>.json`, wraps each section in `<CmsSection>`, and registers the page. The page looks exactly the same afterwards:

```bash
npx visual-cms scan src/app/page.tsx --dry-run     # see which texts it would move
npx visual-cms scan src/app/page.tsx               # do it (the original is saved as page.tsx.visual-cms.bak)
```

Or create a brand-new editable page, and check your setup at any time:

```bash
npx visual-cms add-page about          # content/about.json, a view, app/about/page.tsx, and the config entry
npx visual-cms doctor                  # checks Tailwind, the config, the provider, and the Django API (CORS included)
```

Details: [section 4](#4-make-your-own-pages-editable).

### Step 4. Open the CMS

```bash
npm run dev
```

Open `http://localhost:3000/admin/cms`. Hover a section in the preview, click the pencil, change the text, and watch the preview update. **Save & Publish** puts it on the site. The reset button (circular arrow) goes back to the default. With Django, log in at `http://localhost:8000/admin/` first as a staff user.

### Step 5. Connect your admin panel

If you already have an admin panel, continue with [section 2](#2-connect-it-to-your-admin-panel). It takes two small edits.

### Try the demo app first (optional)

The repository includes a complete working app:

```bash
git clone https://github.com/MostofaSeum/Public-Site-CMS.git
cd Public-Site-CMS/examples/next-demo
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

Copy the prompt from [the top of this README](#let-your-ai-agent-do-it) into your AI coding agent. The rest of this section is the detailed procedure the agent follows. After the library is installed, this README is also at `node_modules/@brainicon/visual-cms/README.md`.

### Instructions for the agent

**Rules**

1. Work on a new git branch. If the working tree has uncommitted changes, ask the developer before continuing.
2. Use the commands (`init`, `scan`, `add-page`, `doctor`). Do not hand-write the files they generate.
3. Always pass `--yes` to `init` (no interactive questions), and run every command with `--dry-run` once first.
4. Visitors must see the same website as before. After every step run `npx tsc --noEmit` (or the build). If it fails, fix it or undo that step before continuing.
5. Do not edit anything inside `node_modules`.
6. Never leave editing open to everyone. With the file backend the generated `authorize()` only allows editing under `next dev`: replace it with the project's real login check. If you cannot work out the project's login, leave the generated check as it is and tell the developer. With Django, Django's staff login decides.
7. Do not commit `.cms/` or `public/cms-uploads/` (init already adds them to `.gitignore`).
8. Check the result of every step before the next one. If a check fails, use [Troubleshooting](#7-troubleshooting) and `npx visual-cms doctor`. Do not guess.
9. Ask the developer only for inputs you cannot find yourself.

**Inputs**

| Name | Meaning | How to get it |
|---|---|---|
| `PROJECT` | the website's root folder | the folder with the `package.json` that lists `next` |
| `BACKEND` | `files` (default) or `django` | `django` when the repository has a Django project (a folder with `manage.py`) that should hold the content; otherwise `files` |
| `DJANGO_DIR` | the folder with `manage.py`, `django` only | search the repository |
| `API_URL` / `FRONTEND_ORIGIN` | where Django and the site run, `django` only | defaults `http://localhost:8000/api/cms` and `http://localhost:3000`; check the project's config and scripts |
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
| `next.config.*` contains `cacheComponents: true` | note it | pass `--no-example` to `init` |
| `git status` | clean, or the developer agreed | create the branch `visual-cms-setup` |

**Step 2. Find the admin panel.** Decide which case applies:

- List the folders under `app/` (or `src/app/`) and look for `admin`, `dashboard`, `manage`, `backoffice`, or a route group like `(admin)`. Open its `layout.tsx` and any `middleware.ts`. Note the login check they use: that is `AUTH_FN`.
- Search that folder for the file that renders the menu: grep for the labels of existing menu items ("Dashboard", "Users", "Settings") or for components named `Sidebar`, `Nav`, `Menu`. That is `MENU_FILE`.
- Result: **NO_ADMIN** (nothing found: [Case A](#case-a-no-admin-panel-yet)), **NEXT_ADMIN** (found in this app: [Case B](#case-b-your-admin-panel-is-part-of-this-nextjs-app)), or **EXTERNAL_ADMIN** (the admin is another app: [Case C](#case-c-your-admin-panel-is-a-different-app)).
- If you are unsure which case applies, ask the developer one question: "Where is your admin panel?"

**Step 3. Install the library.**

```bash
npm install github:MostofaSeum/Public-Site-CMS#v0.2.0
npx visual-cms --version
```

Pass when the last command prints a version.

**Step 4. Run `init`.** Build the command from the inputs, run it with `--dry-run` first, read the plan, then run it for real:

| Situation | Command |
|---|---|
| NO_ADMIN or EXTERNAL_ADMIN, files backend | `npx visual-cms init --yes` |
| NEXT_ADMIN | add `--admin-path "<ADMIN_AREA>/cms"` |
| Django backend | add `--django-dir <DJANGO_DIR>`, plus `--api-url <API_URL> --frontend-origin <FRONTEND_ORIGIN>` when they differ from the defaults |
| `cacheComponents: true`, or the developer does not want the example page | add `--no-example` |
| Package install must be skipped | add `--no-install` and install `lucide-react react-hot-toast` yourself |

Pass when the command exits with code 0 and lists created and modified files. **Every line under "Warnings" and "Still to do by hand" in its output is a task for you:** do it, or report it to the developer. Then run `npx tsc --noEmit`.

**Step 5. Connect the admin panel.**

- **NO_ADMIN:** nothing to do.
- **NEXT_ADMIN:** do [Case B](#case-b-your-admin-panel-is-part-of-this-nextjs-app) steps 3 and 4: add the link to `MENU_FILE` in the menu's own style, and (file backend) replace `authorize` using `AUTH_FN`.
- **EXTERNAL_ADMIN:** do [Case C](#case-c-your-admin-panel-is-a-different-app): add a link to the CMS page in the other admin, and (file backend) replace `authorize` with a check the site can perform.

**Step 6. Make the pages editable.** One page at a time, homepage first:

1. `npx visual-cms scan <page file> --dry-run`. Read the list of texts. It moves only static text and `placeholder`/`alt` attributes; code, state and API data stay as they are.
2. If it reports a Server Component: when the page has no server-only code (not `async`, no `metadata`/`generateMetadata` export, no database, `fs` or server-only imports), re-run with `--add-use-client`. Otherwise create `components/<Name>View.tsx` with `'use client'`, move the page's JSX into it (keep the server code in the page and pass data as props), render `<NameView />` from the page, and scan the new file with `--page <key> --route <url>`.
3. Run it without `--dry-run`, then `git diff` and `npx tsc --noEmit`. The page must render the same as before. If anything is wrong, restore the file from `<file>.visual-cms.bak`, remove the page entry from `cms.config.ts` and delete `content/<key>.json`.
4. Optional: blocks written out by hand several times (for example four copied cards) became separate fields. You may turn them into an array in the JSON plus a `.map()` in the code, so editors can add and remove items. Keep the output identical.

**Step 7. Verify.** Pass only when all of these hold (the dev server uses port 3000 unless the project says otherwise):

```bash
npx tsc --noEmit                      # exit code 0 (or: npm run build)
npx visual-cms doctor                 # no FAIL lines
npm run dev                           # start it in the background, wait until it is ready
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000<ADMIN_URL>"   # 200, or a redirect to the login page when the admin is protected. Not 404.
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/"             # 200
```

If you have a browser tool: open the CMS URL (with Django, log in first at `http://localhost:8000/admin/` as a staff user, using `localhost`), confirm the preview loads, hover a section, click the pencil, change a text, **Save & Publish**, check the public page, then reset it. Stop the dev server you started.

**Step 8. Report to the developer.** Say what was created and edited, the CMS URL, where the menu link was added, which pages are editable, and what is still theirs to do: the real login check for the file backend if you could not add it, a staff user for Django, and a database-backed storage before deploying to a serverless host ([Before you go live](#5-before-you-go-live)).

**Common mistakes to avoid**

- Running `init` without `--yes` (it can wait for input that never comes).
- Running `init` with the default `--admin-path` when the real admin is elsewhere, which puts the CMS page outside the login guard.
- Forgetting that `--admin-path` must be quoted when it contains parentheses.
- Removing `authorize` or making it always return `true`.
- Adding `'use client'` to a page that is `async`, exports `metadata`, or reads a database.
- Wrapping a section in `<CmsSection sectionKey="x">` without adding `x` to that page's `sections` in `cms.config.ts` (`scan` and `add-page` do this for you).
- Logging in to Django at `127.0.0.1` while the site calls `localhost` (the login cookie is not shared, so saving fails with 401).

---

## 4. Make your own pages editable

`init` sets up the CMS. Then make each page editable.

**The quick way: `scan`.** For an existing page:

```bash
npx visual-cms scan src/app/page.tsx --dry-run
npx visual-cms scan src/app/page.tsx
```

It reads the file with your project's TypeScript compiler, finds its sections (`<header>`, `<section>`, `<footer>`, `<nav>`…, or the top-level blocks when there are none), and:

- moves every static text, and every `placeholder` and `alt` attribute, into `content/<page>.json` (one object per section),
- replaces each of them with the matching value from `usePageContent()`,
- wraps each section in `<CmsSection>` (no wrapper is rendered for visitors),
- registers the page and its sections in `cms.config.ts`.

It leaves code alone: state, props, API data, string literals inside expressions, `<code>`/`<pre>` blocks and anything inside an element marked `data-cms-ignore`. The page renders the same HTML as before (this is what the tests check). The original file is saved as `<file>.visual-cms.bak`, and the rewritten file is checked for syntax errors before anything is written.

Things to know:

- The page must be a client component, because the content is read with a hook. For a Server Component it stops and explains: pass `--add-use-client` when the page has no server-only code, or move the JSX into a client component and scan that file with `--page` and `--route`.
- The page key and route come from the file's place under `app/` (`app/page.tsx` is `home` at `/`). Pass `--page` and `--route` for files elsewhere.
- Blocks written out several times by hand (four copied cards) become separate fields. Turn them into an array plus `.map()` by hand if editors should add or remove items.
- Images that use `src={...}` and texts built in code are not moved. Edit them by hand if needed.

**By hand.** Three steps, using the generated example as the pattern.

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
- Give list items an `id`. Name image fields like `image`, `logo`, `avatar` or `src` to get the image picker, and icon fields like `icon` to get the icon picker. To draw the chosen icon on the page, either map the names you offer to icons you import yourself (small bundle, recommended: `const ICONS = { Zap, Server }` then `ICONS[item.icon] ?? Zap`), or use `getDynamicIcon(name)` from `@brainicon/visual-cms/icons`, which can draw any icon but adds the whole lucide icon set (about 0.9 MB) to your public bundle.
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

Django keeps the content in its database and uses your Django logins.

#### The one-command way (recommended)

```bash
npx visual-cms init --django-dir <folder with manage.py> --frontend-origin http://localhost:3000
```

Use `--api-url` if Django is not at `http://localhost:8000/api/cms`. For the Django side the command does exactly this, and prints each step:

| Step | File |
|---|---|
| installs `django-visual-cms` (from the copy inside the library package) and `django-cors-headers` | your Django virtual environment |
| adds `"visual_cms"` and `"corsheaders"` to `INSTALLED_APPS` | `settings.py` |
| adds `"corsheaders.middleware.CorsMiddleware"` as the first `MIDDLEWARE` entry | `settings.py` |
| adds your frontend origin to `CSRF_TRUSTED_ORIGINS` and `CORS_ALLOWED_ORIGINS`, sets `CORS_ALLOW_CREDENTIALS = True` | `settings.py` |
| adds `path("api/cms/", include("visual_cms.urls"))` (and imports `include`) | root `urls.py` |
| runs `python manage.py migrate visual_cms` | database |

A copy of each edited file is saved next to it as `*.visual-cms.bak`. Running the command again changes nothing. If a file has an unusual shape (for example `INSTALLED_APPS` built by code), that step is skipped and the exact lines to add are printed under "Still to do by hand". `django-cors-headers` is needed because the Next.js site and Django run on different ports; if the frontend reaches Django through the same origin (a reverse proxy or a Next.js rewrite), pass `--no-cors` to the Django helper (see below) to skip it.

You can also run the Django part on its own, without the Next.js part:

```bash
pip install "git+https://github.com/MostofaSeum/Public-Site-CMS.git@v0.2.0#subdirectory=django-visual-cms"
python -m visual_cms setup --project <folder with manage.py> --frontend-origin http://localhost:3000 [--dry-run] [--no-cors] [--no-migrate]
```

Then create the editor login: any Django user with **staff** status can edit (`python manage.py createsuperuser` makes one). Editors log in at your Django admin first; the CMS uses that session.

#### By hand

Install the package (`pip install "git+https://github.com/MostofaSeum/Public-Site-CMS.git@v0.2.0#subdirectory=django-visual-cms"`), add `"visual_cms"` to `INSTALLED_APPS`, add `path("api/cms/", include("visual_cms.urls"))` to the root `urls.py`, run `python manage.py migrate`, and configure CORS and `CSRF_TRUSTED_ORIGINS` as described in [django-visual-cms/README.md](django-visual-cms/README.md). On the frontend run `npx visual-cms init --backend django --api-url https://api.example.com/api/cms`. This generates `cms.config.ts` with `djangoAdapter`, which sends the Django session cookie and handles Django's CSRF token. No Next.js API route or `fileStorage` is created.

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
| anything does not work | many possible causes | run `npx visual-cms doctor`: it checks the common ones and says what to fix |
| Django: "Failed to save section changes" | you are not logged in to Django as a **staff** user (401), or the CSRF origin is missing (403) | log in at the Django admin (same host name as the site, for example `localhost` not `127.0.0.1`); check `CSRF_TRUSTED_ORIGINS` contains your site's origin |
| `npx visual-cms` tries to download something, or says not found | the library is not installed in this project, or you are in the wrong folder | run `npm install github:MostofaSeum/Public-Site-CMS#v0.2.0` in the project root, then retry |
| "Invalid hook call", or `Cannot read properties of null (reading 'useState')` | two copies of React, usually from linking a local clone of the library (`npm link`, `file:` path) | install from GitHub instead: remove `node_modules/@brainicon`, then `npm install github:MostofaSeum/Public-Site-CMS#v0.2.0` |
| the CMS screen has no styling | the Tailwind `@source` line is missing or points to the wrong place, or Tailwind is v3 | open the CSS file your root layout imports; it must contain `@source "…/node_modules/@brainicon/visual-cms/dist";` below `@import "tailwindcss";` |
| the preview shows "Loading…" forever, or is blank | the page's `route` in `cms.config.ts` is wrong, the page throws an error, a redirect catches the preview, or the site blocks being framed | open the route in a normal tab; check `middleware.ts` ([below](#redirects-and-the-preview-iframe)); remove `X-Frame-Options: DENY` |
| hovering shows no pencil | the block is not wrapped in `<CmsSection>`, `CmsProviders` is missing from the root layout, or Edit Mode is off | wrap the block; check `app/layout.tsx`; turn Edit Mode on in the toolbar |
| clicking the pencil says "Section '…' is not configured for this page" | the `sectionKey` is not in that page's `sections` | add `{ key: '…', label: '…' }` to the page in `cms.config.ts` |
| saving fails with 401 | `authorize()` returned false. The generated one allows editing only under `next dev` | implement your login check ([Case B step 4](#case-b-your-admin-panel-is-part-of-this-nextjs-app)); log in |
| saving fails with 404 "Unknown page" | the page key is not in `cms.config.ts` `pages` | register the page |
| saved edits do not show on the site | the page is cached, or it was saved as a draft | add `export const dynamic = 'force-dynamic'`; use **Save & Publish** |
| edits vanish after a deploy | file storage on a host with a temporary disk | use Django or a database adapter ([section 5](#5-before-you-go-live)) |
| TypeScript error importing a `.json` file | `resolveJsonModule` is off | set `"resolveJsonModule": true` in `tsconfig.json` |
| `Module not found: @brainicon/visual-cms/...` | the library is not installed, or the install is stale | reinstall it ([section 9](#9-updating)), delete `.next`, restart |
| `init` says "not a Next.js project", "Pages Router only" or "needs a TypeScript project" | unsupported project type | follow [Other setups](#other-setups-manual) |
| Django: 403 on save | missing or stale CSRF token | use `djangoAdapter` (not `restAdapter`) and see the CORS/CSRF settings in the Django README |
| `npm install github:...` fails | `git` is not installed, or no access to github.com | install git and check the network; the repository is public |

---

## 8. Reference

### `visual-cms init` options

| Option | Meaning |
|---|---|
| `--backend files\|django` | where content is stored (default `files`) |
| `--api-url <url>` | Django API base URL (default `http://localhost:8000/api/cms`) |
| `--django-dir <path>` | your Django project (folder with `manage.py`, or the folder above it). Also sets up Django: package, settings, urls, CORS, migration. Implies `--backend django` |
| `--frontend-origin <url>` | where this Next.js site runs, allowed by Django (default `http://localhost:3000`) |
| `--admin-path <path>` | folder of the CMS screen under `app/` (default `admin/cms`). Route groups are allowed: `"(admin)/dashboard/cms"` |
| `--no-example` | skip the example page |
| `--no-install` | do not install dependencies |
| `--dry-run` | show what would happen, change nothing |
| `--force` | overwrite existing files that differ |
| `-y, --yes` | accept defaults, ask nothing |
| `--cwd <dir>` | project folder (default: current folder) |
| `-h, --help`, `-v, --version` | help, version |

### `visual-cms scan <file>`

Makes an existing page editable ([section 4](#4-make-your-own-pages-editable)). Options: `--page <key>`, `--route <path>`, `--title <text>`, `--component <Name>` (default: the default export), `--add-use-client`, `--dry-run`. It refuses files that already use `usePageContent`, dynamic routes without `--route`, and page keys or content files that already exist.

### `visual-cms add-page <key>`

Creates an editable page in one step: `content/<key>.json` (default text, one object per section), `components/<Name>View.tsx` (with a `<CmsSection>` per section), `app/<route>/page.tsx` (server page that loads saved content), and registers the page in `cms.config.ts`. It refuses to overwrite existing files.

| Option | Meaning |
|---|---|
| `--title <text>` | name shown in the CMS (default: made from the key) |
| `--route <path>` | public URL (default `/<key>`; nested routes like `/company/team` work) |
| `--sections <a,b,c>` | section keys (default `hero,content`) |
| `--dry-run` | show what would be created |

Afterwards, replace the placeholder markup in the generated view with your own design (keep the `<CmsSection>` wrappers), and put real default text in the JSON file.

### `visual-cms doctor`

Checks the setup and says exactly what to fix: Next.js and the packages, Tailwind v4 and the `@source` line, `cms.config.ts`, the provider, the CMS screen, and (for Django) whether the API answers, whether Django allows your origin with cookies (CORS), and whether saving is allowed by the preflight. It exits with an error code when something is wrong, so it also works in CI. Options: `--api-url <url>` (check another Django URL), `--frontend-origin <url>`. It cannot tell whether you are logged in to Django; if saving still fails with "Failed to save", log in at the Django admin as a staff user.

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
| `getDynamicIcon(name)` | `/icons` | draw any icon chosen in the icon picker (adds the whole lucide icon set to your bundle) |
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

## 9. Updating

Install a newer release by its tag, then restart the dev server:

```bash
npm install github:MostofaSeum/Public-Site-CMS#v0.2.0     # use the new tag
rm -rf .next                                               # PowerShell: Remove-Item -Recurse -Force .next
```

With Django, update the Python package too: run `npx visual-cms init --django-dir <folder>` again (it reinstalls the copy shipped in the package and changes nothing else), or `pip install "git+https://github.com/MostofaSeum/Public-Site-CMS.git@v0.2.0#subdirectory=django-visual-cms"`.

### Development

```bash
git clone https://github.com/MostofaSeum/Public-Site-CMS.git
cd Public-Site-CMS
npm install
npm run typecheck
npm test
npm run build
```

`dist/` is committed, because installing from GitHub uses it directly (there is no build step on the user's machine). **Run `npm run build` and commit `dist/` together with every source change.** To release: bump `version` in `package.json`, `django-visual-cms/pyproject.toml` and `django-visual-cms/visual_cms/__init__.py`, build, commit, then tag and push: `git tag vX.Y.Z && git push origin main --tags`.

The Django package has its own tests: `cd django-visual-cms && python -m django test tests --settings=tests.settings` (set `PYTHONPATH=.` first).

## License

MIT
