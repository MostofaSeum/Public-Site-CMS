"""
Settings, read from the STORIO_EDITOR dict in your Django settings (the older name VISUAL_CMS also works):

    STORIO_EDITOR = {
        "AUTHORIZE": "myproject.cms.can_edit",   # who may edit (default: staff users)
        "ALLOWED_PAGES": ["home", "pricing"],    # restrict page keys (default: any valid key)
        "MAX_BODY_BYTES": 1_048_576,             # largest JSON body for a save
        "MAX_UPLOAD_BYTES": 5_242_880,           # largest uploaded image
        "UPLOAD_DIR": "cms-uploads",             # folder inside your media storage
        "ALLOW_SVG": False,                      # SVG can carry scripts; off by default
        "TOKEN_LOGIN": True,                     # enable POST auth/login (editors sign in from a React admin)
        "TOKEN_MAX_AGE": 43_200,                 # seconds a login token stays valid (12 hours)
        "LOGIN_MAX_ATTEMPTS": 5,                 # wrong passwords per username+IP before a lockout
        "LOGIN_LOCKOUT_SECONDS": 300,            # how long that lockout lasts
    }
"""

from functools import lru_cache
from typing import Any, Callable

from django.conf import settings
from django.utils.module_loading import import_string

DEFAULTS: dict[str, Any] = {
    "AUTHORIZE": "storio_elements_editor.permissions.is_staff_user",
    "ALLOWED_PAGES": None,
    "MAX_BODY_BYTES": 1024 * 1024,
    "MAX_UPLOAD_BYTES": 5 * 1024 * 1024,
    "UPLOAD_DIR": "cms-uploads",
    "ALLOW_SVG": False,
    "TOKEN_LOGIN": True,
    "TOKEN_MAX_AGE": 12 * 60 * 60,
    "LOGIN_MAX_ATTEMPTS": 5,
    "LOGIN_LOCKOUT_SECONDS": 300,
}


def get_setting(name: str) -> Any:
    # VISUAL_CMS is the name used before the rename and is still read.
    user_settings = getattr(settings, "STORIO_EDITOR", None) or getattr(settings, "VISUAL_CMS", None) or {}
    return user_settings.get(name, DEFAULTS[name])


@lru_cache(maxsize=None)
def _import(path: str) -> Callable:
    return import_string(path)


def get_authorize() -> Callable:
    value = get_setting("AUTHORIZE")
    return _import(value) if isinstance(value, str) else value
