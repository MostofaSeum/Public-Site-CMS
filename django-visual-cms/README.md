# django-visual-cms

Django backend for [`@brainicon/visual-cms`](../README.md). It stores the content editors change in the visual CMS and serves the REST API the CMS talks to.

Use it when your site's frontend is React or Next.js and your backend is Django. Django keeps the content in its own database and decides who may edit, through your existing Django logins.

```
React / Next.js site  ──  @brainicon/visual-cms  (CMS screen, live preview, pencil buttons)
        │  djangoAdapter (fetch + session cookie + CSRF)
        ▼
Django  ──  django-visual-cms  (API + CmsRecord table + Django admin)
```

Supports Django 4.2, 5.x and 6.x (tested on 4.2, 5.2 and 6.0).

## Install

```bash
pip install django-visual-cms
```

Until it's published on PyPI, install it from the repository folder:

```bash
pip install "path/to/Public-Site-CMS/django-visual-cms"
```

## Set up Django

**1. Add the app** in `settings.py`:

```python
INSTALLED_APPS = [
    # ...
    "visual_cms",
]
```

**2. Add the URLs** in your root `urls.py`:

```python
from django.urls import include, path

urlpatterns = [
    # ...
    path("api/cms/", include("visual_cms.urls")),
]
```

**3. Create the table:**

```bash
python manage.py migrate
```

**4. Configure media** so uploaded images can be served (skip if your project already does this):

```python
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

Uploads go through Django's default storage, so S3 or any other storage backend you've configured works too.

**That's it.** By default, any logged-in **staff** user can edit.

## Set up the React / Next.js site

Follow the main library's setup, but use `djangoAdapter` instead of `restAdapter`. You don't need the Next.js API route or `fileStorage`, because Django handles saving.

```ts
// cms.config.ts
import { defineCms } from '@brainicon/visual-cms';
import { djangoAdapter } from '@brainicon/visual-cms/adapters';

export const cms = defineCms({
  adapter: djangoAdapter({ baseUrl: 'https://api.example.com/api/cms' }),
  pages: [/* ... */],
});
```

`djangoAdapter` sends the Django session cookie with every request. It also gets a CSRF token from `/api/cms/csrf`, sends it on saves, uploads and resets, and refreshes it if it goes stale.

For server rendering in Next.js, read published content directly from Django:

```ts
import { getPageContent } from '@brainicon/visual-cms/next';
import { restAdapter } from '@brainicon/visual-cms/adapters';

const storage = restAdapter({ baseUrl: 'https://api.example.com/api/cms' }); // read-only use
const content = await getPageContent(cms, 'home', { storage });
```

### Logging in

Editors log in to Django the usual way (Django admin login, your own login page, allauth…), and the CMS uses that session. If the frontend and Django are on different domains, the session cookie must be allowed to travel with cross-site requests. See the next section.

## Frontend and Django on different domains

Same domain (for example Django behind `example.com/api/` through a reverse proxy) needs nothing extra.

For different origins (for example `example.com` and `api.example.com`), install `django-cors-headers` and add:

```python
INSTALLED_APPS += ["corsheaders"]
MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")

CORS_ALLOWED_ORIGINS = ["https://example.com"]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = ["https://example.com"]

# Only when the two are different *sites* (not just subdomains of one domain):
SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = True
```

Also set `publicSiteUrl` / `allowedOrigins` in the frontend CMS config if the CMS screen and the public site run on different origins.

## Settings

All settings are optional. Put them in a `VISUAL_CMS` dict:

```python
VISUAL_CMS = {
    # Who may edit. A dotted path to a function that receives the request.
    "AUTHORIZE": "visual_cms.permissions.is_staff_user",
    # Restrict which page keys can be stored (use your frontend config's page keys).
    "ALLOWED_PAGES": None,          # e.g. ["home", "pricing"]
    "MAX_BODY_BYTES": 1_048_576,    # largest section save (1 MB)
    "MAX_UPLOAD_BYTES": 5_242_880,  # largest image upload (5 MB)
    "UPLOAD_DIR": "cms-uploads",    # folder inside your media storage
    "ALLOW_SVG": False,             # SVG files can contain scripts; enable only if you trust editors
}
```

A custom permission check, for example for members of an "Editors" group:

```python
# myproject/cms.py
def can_edit(request):
    user = request.user
    return user.is_authenticated and user.groups.filter(name="Editors").exists()
```

```python
VISUAL_CMS = {"AUTHORIZE": "myproject.cms.can_edit"}
```

## Django admin

Saved sections appear under **Visual CMS → CMS sections**. From there admins can search them, inspect the JSON, and publish or unpublish several at once. Deleting a row resets that section to its default content.

The visual editing itself (live preview, pencil buttons, forms) happens on the React CMS page. Add a link to it in your admin menu if you like.

## API

All responses are JSON. Every path works with or without a trailing slash.

| Method | Path | Who | Result |
|---|---|---|---|
| GET | `records?page=home` | anyone | published records of a page |
| GET | `records?page=home&drafts=1` | editors | includes drafts (visitors still get published only) |
| GET | `records/<page>/<section>` | anyone | the record, or `null` if never edited |
| PUT | `records/<page>/<section>` | editors | body `{"content": ..., "isPublished": true}` |
| DELETE | `records/<page>/<section>` | editors | `204`, section back to its default |
| GET | `media` | editors | uploaded images |
| POST | `media` | editors | multipart `files` → `{"items": [...]}` |
| GET | `csrf` | anyone | `{"csrfToken": "..."}` and sets the CSRF cookie |

Writes need an editor (`401` otherwise) and a valid `X-CSRFToken` header (`403` otherwise). Page and section keys may only contain letters, digits, `_` and `-`.

## Security notes

- Visitors only ever get published content. Drafts need `drafts=1` **and** an editor.
- CSRF protection stays on for every write, with errors returned as JSON.
- Uploads are limited to image types (no SVG by default) and a size cap. They are stored under random names, never the client's file name.

## Development

```bash
cd django-visual-cms
pip install -e .
python -m django test tests --settings=tests.settings
```

(On Windows PowerShell: `$env:PYTHONPATH="."` first if the `tests` module isn't found.)

## License

MIT
