"""`python -m visual_cms setup`: wires django-visual-cms into an existing Django project.

It edits the project's settings and root urls (after saving a backup copy), then runs the
migration. It never needs Django to be configured, so it works before the app is installed
in INSTALLED_APPS. Every edit is a small text insertion; if a file has an unusual shape the
step is skipped and the exact lines to add by hand are printed instead.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

SKIP_DIRS = {"venv", ".venv", "env", "node_modules", ".git", "__pycache__", "site-packages", "build", "dist"}
BACKUP_SUFFIX = ".visual-cms.bak"


class SetupError(Exception):
    pass


@dataclass
class Report:
    done: list[str] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    manual: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- project discovery
def find_manage_py(start: Path) -> Path:
    start = start.resolve()
    if (start / "manage.py").is_file():
        return start / "manage.py"
    found: list[Path] = []
    for root, dirs, files in os.walk(start):
        depth = len(Path(root).relative_to(start).parts)
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")] if depth < 2 else []
        if "manage.py" in files:
            found.append(Path(root) / "manage.py")
    if not found:
        raise SetupError(f"No manage.py found in {start} (looked two folders deep). Pass --project <folder with manage.py>.")
    if len(found) > 1:
        names = ", ".join(str(p.parent) for p in found)
        raise SetupError(f"Several Django projects found ({names}). Pass --project <folder> to choose one.")
    return found[0]


def settings_module(manage_py: Path) -> str:
    text = manage_py.read_text(encoding="utf-8")
    match = re.search(r"""DJANGO_SETTINGS_MODULE['"]\s*,\s*['"]([\w.]+)['"]""", text)
    if not match:
        raise SetupError("Could not read DJANGO_SETTINGS_MODULE from manage.py. Pass --settings <dotted.module.path>.")
    return match.group(1)


def module_file(project_dir: Path, dotted: str) -> Path:
    base = project_dir.joinpath(*dotted.split("."))
    for candidate in (base.with_suffix(".py"), base / "__init__.py"):
        if candidate.is_file():
            return candidate
    raise SetupError(f"Could not find the file for module {dotted!r} under {project_dir}.")


def root_urlconf(settings_text: str, settings_dotted: str) -> str:
    match = re.search(r"""^ROOT_URLCONF\s*=\s*['"]([\w.]+)['"]""", settings_text, re.MULTILINE)
    if match:
        return match.group(1)
    return settings_dotted.rsplit(".", 1)[0] + ".urls"


# --------------------------------------------------------------------------- text edits
def _find_bracket_block(text: str, name: str) -> tuple[int, int] | None:
    """Return (open_index, close_index) of the `[...]` or `(...)` assigned to `name`."""
    match = re.search(rf"^{name}\s*(?::[^=\n]+)?=\s*([\[(])", text, re.MULTILINE)
    if not match:
        return None
    opener = match.group(1)
    closer = "]" if opener == "[" else ")"
    start = match.end() - 1
    depth = 0
    in_str: str | None = None
    i = start
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                i += 1
            elif ch == in_str:
                in_str = None
        elif ch == "#":
            i = text.find("\n", i)
            if i == -1:
                return None
        elif ch in "'\"":
            in_str = ch
        elif ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return start, i
        i += 1
    return None


def _append_item(text: str, name: str, item_literal: str) -> str | None:
    """Add `item_literal` as the last element of the list assigned to `name`."""
    block = _find_bracket_block(text, name)
    if block is None:
        return None
    start, end = block
    inner = text[start + 1 : end]
    if "\n" in inner:
        lines = [l for l in inner.splitlines() if l.strip() and not l.strip().startswith("#")]
        indent = re.match(r"\s*", lines[-1]).group(0) if lines else "    "
        before = text[:end].rstrip()
        if not before.endswith(",") and not before.endswith(text[start]):
            before += ","
        return f"{before}\n{indent}{item_literal},\n{text[end:]}"
    stripped = inner.strip()
    sep = ", " if stripped and not stripped.endswith(",") else (" " if stripped else "")
    return f"{text[:end]}{sep}{item_literal}{text[end:]}"


def patch_installed_apps(text: str, app: str = "visual_cms") -> tuple[str, str]:
    """Returns (new_text, status) with status in changed | already | failed."""
    block = _find_bracket_block(text, "INSTALLED_APPS")
    if block is None:
        return text, "failed"
    if re.search(rf"""['"]{app}(\.apps\.\w+)?['"]""", text[block[0] : block[1]]):
        return text, "already"
    patched = _append_item(text, "INSTALLED_APPS", f'"{app}"')
    return (patched, "changed") if patched else (text, "failed")


def patch_middleware(text: str, entry: str = "corsheaders.middleware.CorsMiddleware") -> tuple[str, str]:
    """Put `entry` first in MIDDLEWARE (CorsMiddleware must run before anything that can answer a request)."""
    block = _find_bracket_block(text, "MIDDLEWARE")
    if block is None:
        return text, "failed"
    start, end = block
    inner = text[start + 1 : end]
    if re.search(rf"""['"]{re.escape(entry)}['"]""", inner):
        return text, "already"
    if "\n" in inner:
        lines = [l for l in inner.splitlines() if l.strip() and not l.strip().startswith("#")]
        indent = re.match(r"\s*", lines[0]).group(0) if lines else "    "
        return f'{text[: start + 1]}\n{indent}"{entry}",{text[start + 1 :]}', "changed"
    sep = ", " if inner.strip() else ""
    return f'{text[: start + 1]}"{entry}"{sep}{text[start + 1 :]}', "changed"


def _pip_install(package: str) -> bool:
    result = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", package], capture_output=True, text=True)
    return result.returncode == 0


def patch_origin_list(text: str, name: str, origins: list[str]) -> tuple[str, list[str], str]:
    """Make sure every origin is in the list `name`; create it if the setting does not exist.

    Returns (new_text, added_origins, status) with status in changed | already | failed.
    """
    block = _find_bracket_block(text, name)
    if block is None:
        if re.search(rf"^{name}\s*[+=]", text, re.MULTILINE):
            return text, [], "failed"
        literal = "[" + ", ".join(f'"{o}"' for o in origins) + "]"
        suffix = "" if text.endswith("\n") else "\n"
        return f"{text}{suffix}\n{name} = {literal}\n", origins, "changed"
    current = text[block[0] : block[1]]
    missing = [o for o in origins if o not in current]
    if not missing:
        return text, [], "already"
    for origin in missing:
        patched = _append_item(text, name, f'"{origin}"')
        if patched is None:
            return text, [], "failed"
        text = patched
    return text, missing, "changed"


def set_boolean(text: str, name: str, value: bool) -> tuple[str, str]:
    literal = "True" if value else "False"
    match = re.search(rf"^{name}\s*=\s*(\w+)", text, re.MULTILINE)
    if match:
        if match.group(1) == literal:
            return text, "already"
        return text[: match.start(1)] + literal + text[match.end(1) :], "changed"
    suffix = "" if text.endswith("\n") else "\n"
    return f"{text}{suffix}{name} = {literal}\n", "changed"


def patch_media_settings(text: str) -> tuple[str, list[str], str]:
    """Give uploads a public URL and a folder. Returns (new_text, added_names, status)."""
    if re.search(r"^(STORAGES|DEFAULT_FILE_STORAGE)\s*=", text, re.MULTILINE):
        return text, [], "already"  # The project chose its own storage (S3...): leave it alone.
    has_url = re.search(r"^MEDIA_URL\s*=", text, re.MULTILINE) is not None
    has_root = re.search(r"^MEDIA_ROOT\s*=", text, re.MULTILINE) is not None
    if has_url and has_root:
        return text, [], "already"
    if not has_root and re.search(r"^BASE_DIR\s*=", text, re.MULTILINE) is None:
        return text, [], "failed"
    lines, added = [], []
    if not has_url:
        lines.append('MEDIA_URL = "/media/"')
        added.append("MEDIA_URL")
    if not has_root:
        lines.append('MEDIA_ROOT = BASE_DIR / "media"' if re.search(r"^BASE_DIR\s*=\s*Path\(", text, re.MULTILINE) else 'MEDIA_ROOT = os.path.join(BASE_DIR, "media")')
        added.append("MEDIA_ROOT")
    if any("os.path" in line for line in lines) and re.search(r"^import os\b", text, re.MULTILINE) is None:
        lines.insert(0, "import os")
    suffix = "" if text.endswith("\n") else "\n"
    return f"{text}{suffix}\n# Uploaded images (added by django-visual-cms)\n" + "\n".join(lines) + "\n", added, "changed"


def patch_media_urls(text: str) -> tuple[str, str]:
    """Let Django serve uploaded images while DEBUG is True (static() does nothing in production)."""
    if re.search(r"static\(\s*settings\.MEDIA_URL", text):
        return text, "already"
    if _find_bracket_block(text, "urlpatterns") is None:
        return text, "failed"
    suffix = "" if text.endswith("\n") else "\n"
    return (
        f"{text}{suffix}\n# Serves uploaded images during development (added by django-visual-cms)\n"
        "from django.conf import settings  # noqa: E402\n"
        "from django.conf.urls.static import static  # noqa: E402\n\n"
        "urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)\n",
        "changed",
    )


def _imports_include(text: str) -> bool:
    """True when `include` is actually imported from django.urls (docstring mentions do not count)."""
    for match in re.finditer(r"^from django\.urls import (\([^)]*\)|[^\n]+)", text, re.MULTILINE):
        if re.search(r"\binclude\b", match.group(1)):
            return True
    return False


def patch_urls(text: str) -> tuple[str, str]:
    if re.search(r"""['"]visual_cms\.urls['"]""", text):
        return text, "already"
    block = _find_bracket_block(text, "urlpatterns")
    if block is None:
        return text, "failed"

    # Make sure `include` is imported from django.urls.
    imp = re.search(r"^from django\.urls import ([^\n(]+)$", text, re.MULTILINE)
    imp_paren = re.search(r"^from django\.urls import \(([^)]*)\)", text, re.MULTILINE | re.DOTALL)
    if _imports_include(text):
        pass
    elif imp:
        names = [n.strip() for n in imp.group(1).split(",") if n.strip()]
        names = sorted(set(names + ["include"]), key=lambda n: (n.lower()))
        text = text[: imp.start()] + "from django.urls import " + ", ".join(names) + text[imp.end() :]
    elif imp_paren:
        body = imp_paren.group(1)
        text = text[: imp_paren.start(1)] + body.rstrip() + ("" if body.rstrip().endswith(",") else ",") + " include," + text[imp_paren.end(1) :]
    else:
        # No django.urls import at all: add one above the first import line.
        first = re.search(r"^(from|import) ", text, re.MULTILINE)
        pos = first.start() if first else 0
        text = text[:pos] + "from django.urls import include\n" + text[pos:]

    block = _find_bracket_block(text, "urlpatterns")
    if block is None:
        return text, "failed"
    start, end = block
    inner = text[start + 1 : end]
    entry = 'path("api/cms/", include("visual_cms.urls"))'
    if "\n" in inner:
        lines = [l for l in inner.splitlines() if l.strip() and not l.strip().startswith("#")]
        indent = re.match(r"\s*", lines[0]).group(0) if lines else "    "
        return f"{text[: start + 1]}\n{indent}{entry},{text[start + 1 :]}", "changed"
    return f"{text[: start + 1]}{entry}, {text[start + 1 :]}".replace(", ]", "]"), "changed"


# --------------------------------------------------------------------------- orchestration
def _write(path: Path, new_text: str, dry_run: bool) -> None:
    if dry_run:
        return
    backup = path.with_name(path.name + BACKUP_SUFFIX)
    if not backup.exists():
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(new_text, encoding="utf-8")


def run_setup(
    project: Path,
    origins: list[str],
    *,
    settings: str | None = None,
    dry_run: bool = False,
    migrate: bool = True,
    cors: bool = True,
) -> Report:
    report = Report()
    manage_py = find_manage_py(project)
    project_dir = manage_py.parent
    dotted = settings or settings_module(manage_py)
    settings_file = module_file(project_dir, dotted)
    settings_text = settings_file.read_text(encoding="utf-8")
    urls_dotted = root_urlconf(settings_text, dotted)
    urls_file = module_file(project_dir, urls_dotted)
    rel = lambda p: str(p.relative_to(project_dir)).replace("\\", "/")

    # ---- settings.py
    text = settings_text
    steps: list[str] = []
    apps_ready = True

    text, status = patch_installed_apps(text)
    if status == "changed":
        steps.append('added "visual_cms" to INSTALLED_APPS')
    elif status == "already":
        report.unchanged.append('"visual_cms" is already in INSTALLED_APPS')
    else:
        apps_ready = False
        report.manual.append(f'In {rel(settings_file)} add "visual_cms" to INSTALLED_APPS (it is not a plain list, so it was not edited).')

    text, added, status = patch_origin_list(text, "CSRF_TRUSTED_ORIGINS", origins)
    if status == "changed":
        steps.append("added " + ", ".join(added) + " to CSRF_TRUSTED_ORIGINS")
    elif status == "already":
        report.unchanged.append("CSRF_TRUSTED_ORIGINS already lists the frontend")
    else:
        report.manual.append(f"In {rel(settings_file)} make sure CSRF_TRUSTED_ORIGINS contains: {', '.join(origins)}")

    uses_cors = re.search(r"""['"]corsheaders['"]""", text) is not None
    if cors and not uses_cors:
        # The frontend runs on another port, so Django needs django-cors-headers: install and wire it up.
        if dry_run:
            installed = True
            steps.append("would install django-cors-headers")
        else:
            installed = _pip_install("django-cors-headers")
            if not installed:
                report.warnings.append("Could not install django-cors-headers (no network?). Install it yourself: pip install django-cors-headers")
        if installed:
            text, st_apps = patch_installed_apps(text, "corsheaders")
            text, st_mw = patch_middleware(text)
            if st_apps == "changed":
                steps.append('added "corsheaders" to INSTALLED_APPS')
            if st_mw == "changed":
                steps.append('added "corsheaders.middleware.CorsMiddleware" as the first MIDDLEWARE entry')
            if "failed" in (st_apps, st_mw):
                report.manual.append(
                    f'In {rel(settings_file)} add "corsheaders" to INSTALLED_APPS and "corsheaders.middleware.CorsMiddleware" as the FIRST entry of MIDDLEWARE (they are not plain lists, so they were not edited).'
                )
            else:
                uses_cors = True
    if cors and uses_cors:
        text, added, status = patch_origin_list(text, "CORS_ALLOWED_ORIGINS", origins) if "CORS_ALLOW_ALL_ORIGINS = True" not in text else (text, [], "already")
        if status == "changed":
            steps.append("added " + ", ".join(added) + " to CORS_ALLOWED_ORIGINS")
        elif status == "failed":
            report.manual.append(f"In {rel(settings_file)} make sure CORS_ALLOWED_ORIGINS contains: {', '.join(origins)}")
        text, status = set_boolean(text, "CORS_ALLOW_CREDENTIALS", True)
        if status == "changed":
            steps.append("set CORS_ALLOW_CREDENTIALS = True (the CMS sends the login cookie)")
    elif cors and not any("corsheaders" in m for m in report.manual):
        report.manual.append(
            "The CMS runs on a different origin than Django, so Django must allow it. Install django-cors-headers and add: "
            'INSTALLED_APPS += ["corsheaders"]; MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware"); '
            f"CORS_ALLOWED_ORIGINS = {origins}; CORS_ALLOW_CREDENTIALS = True."
        )

    text, added, status = patch_media_settings(text)
    if status == "changed":
        steps.append("set " + " and ".join(added) + " so uploaded images can be opened")
    elif status == "failed":
        report.manual.append(f'In {rel(settings_file)} set MEDIA_URL = "/media/" and MEDIA_ROOT to a folder for uploaded images.')

    if steps:
        _write(settings_file, text, dry_run)
        report.done.extend(f"{rel(settings_file)}: {s}" for s in steps)

    # ---- urls.py
    urls_text = urls_file.read_text(encoding="utf-8")
    new_urls, status = patch_urls(urls_text)
    if status == "changed":
        _write(urls_file, new_urls, dry_run)
        report.done.append(f'{rel(urls_file)}: added path("api/cms/", include("visual_cms.urls"))')
    elif status == "already":
        report.unchanged.append("the CMS urls are already included")
    else:
        report.manual.append(f'In {rel(urls_file)} add to urlpatterns:  path("api/cms/", include("visual_cms.urls"))  (and import include from django.urls)')

    urls_now = new_urls if status == "changed" else urls_text
    with_media, media_status = patch_media_urls(urls_now)
    if media_status == "changed":
        _write(urls_file, with_media, dry_run)
        report.done.append(f"{rel(urls_file)}: serves uploaded images while DEBUG is True")
    elif media_status == "failed":
        report.manual.append(f"In {rel(urls_file)} add:  urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)")

    # ---- migrate
    if migrate and not dry_run and apps_ready:
        result = subprocess.run([sys.executable, str(manage_py), "migrate", "visual_cms"], cwd=project_dir, capture_output=True, text=True)
        if result.returncode == 0:
            last = [l for l in result.stdout.splitlines() if l.strip()][-1:] or ["migrated"]
            report.done.append(f"migrate visual_cms: {last[0].strip()}")
        else:
            tail = (result.stderr or result.stdout).strip().splitlines()[-3:]
            report.warnings.append("migrate failed. Run `python manage.py migrate` yourself. " + " | ".join(tail))
    elif migrate and dry_run:
        report.done.append("would run: python manage.py migrate visual_cms")
    elif migrate:
        report.manual.append("Run:  python manage.py migrate")

    if not dry_run and any(l.startswith((rel(settings_file), rel(urls_file))) for l in report.done):
        report.warnings.append(f"A copy of each edited file was saved next to it with the suffix {BACKUP_SUFFIX}. Delete them when you are happy.")
    return report


def print_report(report: Report, dry_run: bool) -> None:
    print("\n" + ("Dry run: nothing was changed. This is what would happen:" if dry_run else "Done."))
    for line in report.done:
        print(f"  + {line}")
    for line in report.unchanged:
        print(f"  = {line}")
    if report.warnings:
        print("\nNotes")
        for line in report.warnings:
            print(f"  ! {line}")
    if report.manual:
        print("\nStill to do by hand")
        for i, line in enumerate(report.manual, 1):
            print(f"  {i}. {line}")
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m visual_cms", description="django-visual-cms helper commands")
    sub = parser.add_subparsers(dest="command", required=True)
    setup = sub.add_parser("setup", help="Wire django-visual-cms into a Django project (settings, urls, migrate)")
    setup.add_argument("--project", default=".", help="Folder with manage.py, or a folder above it (default: current folder)")
    setup.add_argument("--settings", help="Settings module, if it cannot be read from manage.py")
    setup.add_argument(
        "--frontend-origin",
        action="append",
        dest="origins",
        help="Origin of the frontend, e.g. http://localhost:3000 (repeatable; default: http://localhost:3000)",
    )
    setup.add_argument("--no-migrate", action="store_true", help="Do not run the migration")
    setup.add_argument("--no-cors", action="store_true", help="Do not touch CORS settings")
    setup.add_argument("--dry-run", action="store_true", help="Show what would change without writing anything")
    args = parser.parse_args(argv)

    origins = args.origins or ["http://localhost:3000"]
    try:
        report = run_setup(
            Path(args.project),
            origins,
            settings=args.settings,
            dry_run=args.dry_run,
            migrate=not args.no_migrate,
            cors=not args.no_cors,
        )
    except SetupError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print_report(report, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
