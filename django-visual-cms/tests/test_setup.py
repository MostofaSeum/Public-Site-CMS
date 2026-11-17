import tempfile
import textwrap
from pathlib import Path

from unittest import mock

from django.test import SimpleTestCase

from visual_cms import setup_cmd as s

ORIGIN = "http://localhost:3000"

SETTINGS_STD = textwrap.dedent(
    '''
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve().parent.parent
    INSTALLED_APPS = [
        'django.contrib.admin',
        'django.contrib.auth',  # auth
        'django.contrib.staticfiles',
    ]
    MIDDLEWARE = []
    ROOT_URLCONF = 'proj.urls'
    '''
)

URLS_STD = textwrap.dedent(
    '''
    from django.contrib import admin
    from django.urls import path

    urlpatterns = [
        path('admin/', admin.site.urls),
    ]
    '''
)


def make_project(settings=SETTINGS_STD, urls=URLS_STD, manage_module="proj.settings"):
    root = Path(tempfile.mkdtemp())
    (root / "proj").mkdir()
    (root / "proj" / "__init__.py").write_text("")
    (root / "proj" / "settings.py").write_text(settings)
    (root / "proj" / "urls.py").write_text(urls)
    (root / "manage.py").write_text(f"os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{manage_module}')\n")
    return root


class InstalledAppsTests(SimpleTestCase):
    def test_adds_to_multiline_list_keeping_comments(self):
        text, status = s.patch_installed_apps(SETTINGS_STD)
        self.assertEqual(status, "changed")
        self.assertIn("'django.contrib.auth',  # auth", text)
        self.assertIn('    "visual_cms",\n]', text)
        compile(text, "settings", "exec")

    def test_idempotent(self):
        once, _ = s.patch_installed_apps(SETTINGS_STD)
        twice, status = s.patch_installed_apps(once)
        self.assertEqual(status, "already")
        self.assertEqual(once, twice)

    def test_one_line_list_and_missing_trailing_comma(self):
        text, status = s.patch_installed_apps("INSTALLED_APPS = ['a', 'b']\n")
        self.assertEqual(status, "changed")
        self.assertEqual(text, "INSTALLED_APPS = ['a', 'b', \"visual_cms\"]\n")
        text, _ = s.patch_installed_apps("INSTALLED_APPS = [\n    'a',\n    'b'\n]\n")
        compile(text, "settings", "exec")

    def test_tuple_and_type_annotation(self):
        text, status = s.patch_installed_apps("INSTALLED_APPS = (\n    'a',\n)\n")
        self.assertEqual(status, "changed")
        compile(text, "settings", "exec")
        text, status = s.patch_installed_apps("INSTALLED_APPS: list[str] = [\n    'a',\n]\n")
        self.assertEqual(status, "changed")
        compile(text, "settings", "exec")

    def test_brackets_inside_strings_and_comments_do_not_confuse(self):
        src = "INSTALLED_APPS = [\n    'a]b',  # ] tricky\n    'c',\n]\n"
        text, status = s.patch_installed_apps(src)
        self.assertEqual(status, "changed")
        compile(text, "settings", "exec")
        self.assertIn('"visual_cms"', text)

    def test_apps_config_path_counts_as_installed(self):
        _, status = s.patch_installed_apps("INSTALLED_APPS = [\n    'visual_cms.apps.VisualCmsConfig',\n]\n")
        self.assertEqual(status, "already")

    def test_not_a_list_fails_cleanly(self):
        _, status = s.patch_installed_apps("INSTALLED_APPS = get_apps()\n")
        self.assertEqual(status, "failed")


class OriginTests(SimpleTestCase):
    def test_creates_missing_setting(self):
        text, added, status = s.patch_origin_list("X = 1\n", "CSRF_TRUSTED_ORIGINS", [ORIGIN])
        self.assertEqual(status, "changed")
        self.assertIn(f'CSRF_TRUSTED_ORIGINS = ["{ORIGIN}"]', text)

    def test_appends_to_existing_and_is_idempotent(self):
        src = "CSRF_TRUSTED_ORIGINS = ['https://a.example']\n"
        text, added, status = s.patch_origin_list(src, "CSRF_TRUSTED_ORIGINS", [ORIGIN])
        self.assertEqual((status, added), ("changed", [ORIGIN]))
        again, _, status2 = s.patch_origin_list(text, "CSRF_TRUSTED_ORIGINS", [ORIGIN])
        self.assertEqual(status2, "already")
        self.assertEqual(text, again)

    def test_computed_setting_fails_cleanly(self):
        _, _, status = s.patch_origin_list("CSRF_TRUSTED_ORIGINS += extra\n", "CSRF_TRUSTED_ORIGINS", [ORIGIN])
        self.assertEqual(status, "failed")

    def test_boolean(self):
        text, status = s.set_boolean("CORS_ALLOW_CREDENTIALS = False\n", "CORS_ALLOW_CREDENTIALS", True)
        self.assertEqual((text, status), ("CORS_ALLOW_CREDENTIALS = True\n", "changed"))
        self.assertEqual(s.set_boolean("A = 1\nCORS_ALLOW_CREDENTIALS = True\n", "CORS_ALLOW_CREDENTIALS", True)[1], "already")


class UrlsTests(SimpleTestCase):
    def test_adds_import_and_route(self):
        text, status = s.patch_urls(URLS_STD)
        self.assertEqual(status, "changed")
        self.assertIn("from django.urls import include, path", text)
        self.assertIn('path("api/cms/", include("visual_cms.urls")),', text)
        compile(text, "urls", "exec")

    def test_idempotent(self):
        once, _ = s.patch_urls(URLS_STD)
        self.assertEqual(s.patch_urls(once)[1], "already")

    def test_include_already_imported(self):
        src = "from django.urls import path, include\nurlpatterns = [\n    path('a/', include('a.urls')),\n]\n"
        text, status = s.patch_urls(src)
        self.assertEqual(status, "changed")
        self.assertEqual(text.count("include"), 3)  # import, existing route, new route
        compile(text, "urls", "exec")

    def test_parenthesised_import_and_re_path(self):
        src = "from django.urls import (\n    path,\n    re_path,\n)\nurlpatterns = [\n    path('a/', x),\n]\n"
        text, _ = s.patch_urls(src)
        compile(text, "urls", "exec")
        self.assertIn("include", text.split("urlpatterns")[0])

    def test_no_django_urls_import(self):
        src = "from . import views\nurlpatterns = [\n]\n"
        text, status = s.patch_urls(src)
        self.assertEqual(status, "changed")
        compile(text, "urls", "exec")


class StartprojectUrlsTests(SimpleTestCase):
    def test_docstring_mention_of_include_is_not_an_import(self):
        src = (
            '"""URL configuration.\n\nExamples:\n    1. Add a URL: path(\'blog/\', include(\'blog.urls\'))\n'
            '    from django.urls import include, path\n"""\n'
            "from django.contrib import admin\nfrom django.urls import path\n\n"
            "urlpatterns = [\n    path('admin/', admin.site.urls),\n]\n"
        )
        text, status = s.patch_urls(src)
        self.assertEqual(status, "changed")
        code = text.split('"""', 2)[2]
        self.assertIn("\nfrom django.urls import include, path\n", code)
        compile(text, "urls", "exec")


class MiddlewareTests(SimpleTestCase):
    def test_goes_first_in_multiline_list(self):
        src = "MIDDLEWARE = [\n    'django.middleware.security.SecurityMiddleware',\n    'django.middleware.common.CommonMiddleware',\n]\n"
        text, status = s.patch_middleware(src)
        self.assertEqual(status, "changed")
        self.assertLess(text.index("corsheaders"), text.index("SecurityMiddleware"))
        compile(text, "settings", "exec")
        self.assertEqual(s.patch_middleware(text)[1], "already")

    def test_one_line_empty_and_computed(self):
        text, _ = s.patch_middleware("MIDDLEWARE = ['a']\n")
        self.assertEqual(text, 'MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", \'a\']\n')
        text, _ = s.patch_middleware("MIDDLEWARE = []\n")
        compile(text, "settings", "exec")
        self.assertEqual(s.patch_middleware("MIDDLEWARE = base()\n")[1], "failed")


class ProjectTests(SimpleTestCase):
    def setUp(self):
        # Never touch the network or the real Python environment from tests.
        patcher = mock.patch.object(s, "_pip_install", return_value=False)
        self.pip = patcher.start()
        self.addCleanup(patcher.stop)

    def test_installs_and_wires_cors_headers_when_missing(self):
        self.pip.return_value = True
        settings = SETTINGS_STD.replace("MIDDLEWARE = []", "MIDDLEWARE = [\n    'django.middleware.common.CommonMiddleware',\n]")
        root = make_project(settings=settings)
        report = s.run_setup(root, [ORIGIN], migrate=False)
        self.pip.assert_called_once_with("django-cors-headers")
        text = (root / "proj" / "settings.py").read_text()
        self.assertIn('"corsheaders"', text)
        self.assertLess(text.index("corsheaders.middleware.CorsMiddleware"), text.index("CommonMiddleware"))
        self.assertIn("CORS_ALLOW_CREDENTIALS = True", text)
        self.assertIn(ORIGIN, text.split("CORS_ALLOWED_ORIGINS")[1])
        compile(text, "s", "exec")
        self.assertFalse(report.manual)

    def test_pip_failure_is_reported_not_fatal(self):
        root = make_project()
        report = s.run_setup(root, [ORIGIN], migrate=False)
        self.assertTrue(any("django-cors-headers" in w for w in report.warnings))
        self.assertTrue(any("django-cors-headers" in m for m in report.manual))
        self.assertIn('"visual_cms"', (root / "proj" / "settings.py").read_text())

    def test_no_cors_flag_leaves_cors_alone(self):
        root = make_project()
        s.run_setup(root, [ORIGIN], migrate=False, cors=False)
        self.pip.assert_not_called()
        self.assertNotIn("corsheaders", (root / "proj" / "settings.py").read_text())

    def test_dry_run_changes_nothing(self):
        root = make_project()
        before = (root / "proj" / "settings.py").read_text()
        report = s.run_setup(root, [ORIGIN], dry_run=True)
        self.assertEqual((root / "proj" / "settings.py").read_text(), before)
        self.assertFalse(list(root.rglob("*.visual-cms.bak")))
        self.assertTrue(report.done)

    def test_full_run_edits_files_and_keeps_backup(self):
        root = make_project()
        report = s.run_setup(root, [ORIGIN], migrate=False)
        settings = (root / "proj" / "settings.py").read_text()
        urls = (root / "proj" / "urls.py").read_text()
        self.assertIn('"visual_cms"', settings)
        self.assertIn(ORIGIN, settings)
        self.assertIn("visual_cms.urls", urls)
        self.assertEqual((root / "proj" / "settings.py.visual-cms.bak").read_text(), SETTINGS_STD)
        compile(settings, "s", "exec")
        compile(urls, "u", "exec")
        # No corsheaders in this project, so the CORS requirement is reported instead of edited.
        self.assertTrue(any("django-cors-headers" in m for m in report.manual))

    def test_migrate_not_blocked_by_cors_note(self):
        root = make_project()
        report = s.run_setup(root, [ORIGIN], migrate=True, dry_run=True)
        self.assertTrue(any("would run" in d for d in report.done))

    def test_second_run_is_a_no_op(self):
        root = make_project()
        s.run_setup(root, [ORIGIN], migrate=False)
        snapshot = {p: p.read_text() for p in (root / "proj").glob("*.py")}
        report = s.run_setup(root, [ORIGIN], migrate=False)
        self.assertEqual(snapshot, {p: p.read_text() for p in (root / "proj").glob("*.py")})
        self.assertFalse(report.done)

    def test_cors_headers_project_gets_origin_and_credentials(self):
        settings = SETTINGS_STD.replace("'django.contrib.staticfiles',", "'django.contrib.staticfiles',\n    'corsheaders',") + "CORS_ALLOWED_ORIGINS = ['https://a.example']\n"
        root = make_project(settings=settings)
        s.run_setup(root, [ORIGIN], migrate=False)
        text = (root / "proj" / "settings.py").read_text()
        self.assertIn(ORIGIN, text.split("CORS_ALLOWED_ORIGINS")[1])
        self.assertIn("CORS_ALLOW_CREDENTIALS = True", text)
        compile(text, "s", "exec")

    def test_cors_allow_all_is_left_alone(self):
        settings = SETTINGS_STD.replace("'django.contrib.staticfiles',", "'django.contrib.staticfiles',\n    'corsheaders',") + "CORS_ALLOW_ALL_ORIGINS = True\nCORS_ALLOW_CREDENTIALS = True\n"
        root = make_project(settings=settings)
        s.run_setup(root, [ORIGIN], migrate=False)
        self.assertNotIn("CORS_ALLOWED_ORIGINS", (root / "proj" / "settings.py").read_text())

    def test_finds_manage_py_one_level_down(self):
        outer = Path(tempfile.mkdtemp())
        inner = make_project()
        target = outer / "backend"
        inner.rename(target)
        self.assertEqual(s.find_manage_py(outer), target / "manage.py")

    def test_errors_are_clear(self):
        with self.assertRaises(s.SetupError):
            s.find_manage_py(Path(tempfile.mkdtemp()))
        root = make_project(manage_module="nope.settings")
        with self.assertRaises(s.SetupError):
            s.run_setup(root, [ORIGIN], migrate=False)
