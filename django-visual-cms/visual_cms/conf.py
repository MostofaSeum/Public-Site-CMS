"""
Settings, read from the VISUAL_CMS dict in your Django settings:

    VISUAL_CMS = {
        "AUTHORIZE": "myproject.cms.can_edit",   # who may edit (default: staff users)
        "ALLOWED_PAGES": ["home", "pricing"],    # restrict page keys (default: any valid key)
        "MAX_BODY_BYTES": 1_048_576,             # largest JSON body for a save
        "MAX_UPLOAD_BYTES": 5_242_880,           # largest uploaded image
        "UPLOAD_DIR": "cms-uploads",             # folder inside your media storage
        "ALLOW_SVG": False,                      # SVG can carry scripts; off by default
    }
"""

from functools import lru_cache
from typing import Any, Callable

from django.conf import settings
from django.utils.module_loading import import_string

DEFAULTS: dict[str, Any] = {
    "AUTHORIZE": "visual_cms.permissions.is_staff_user",
    "ALLOWED_PAGES": None,
    "MAX_BODY_BYTES": 1024 * 1024,
    "MAX_UPLOAD_BYTES": 5 * 1024 * 1024,
    "UPLOAD_DIR": "cms-uploads",
    "ALLOW_SVG": False,
}


def get_setting(name: str) -> Any:
    user_settings = getattr(settings, "VISUAL_CMS", {}) or {}
    return user_settings.get(name, DEFAULTS[name])


@lru_cache(maxsize=None)
def _import(path: str) -> Callable:
    return import_string(path)


def get_authorize() -> Callable:
    value = get_setting("AUTHORIZE")
    return _import(value) if isinstance(value, str) else value
