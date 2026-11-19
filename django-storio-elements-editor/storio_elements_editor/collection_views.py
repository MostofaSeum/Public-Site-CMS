"""
Editing records of your own models (blog posts, products...) from the visual editor, for pages
with a [slug] or [id] route. Configure each collection in settings:

    STORIO_EDITOR = {
        "COLLECTIONS": {
            "blog": {
                "model": "blog.Post",                 # app_label.ModelName
                "lookup": "slug",                     # field used as the record id (default "pk")
                "label": "title",                     # field shown in the editor's menu (default str(obj))
                "fields": ["title", "summary", "cover_url"],  # the only fields editors may change
                "queryset": "blog.cms.editable_posts",  # optional: callable(request) -> QuerySet
                "on_save": "blog.cms.post_saved",     # optional: callable(obj, request), e.g. clear a cache
            },
        },
    }

    GET  collections/<key>/items        -> [{id, label}]
    GET  collections/<key>/items/<id>   -> {field: value, ...}
    PUT  collections/<key>/items/<id>   body {values: {...}} -> {field: value, ...}

Only editors (the AUTHORIZE check) may call these. Supported field types: text, slug, email,
URL, number, boolean, date/time and JSON fields. Relations and file fields cannot be edited here.
"""

import datetime
import json
from functools import lru_cache

from django.apps import apps
from django.core.exceptions import FieldDoesNotExist, ValidationError
from django.core.exceptions import RequestDataTooBig
from django.db import models
from django.utils.module_loading import import_string
from django.views.decorators.csrf import csrf_exempt

from .conf import get_setting
from .views import _error, _guard_write, _is_editor, _json, KEY_PATTERN

EDITABLE_FIELDS = (
    models.CharField,  # includes SlugField, EmailField, URLField
    models.TextField,
    models.BooleanField,
    models.IntegerField,  # includes the small, big and positive variants
    models.FloatField,
    models.DateField,  # includes DateTimeField
    models.TimeField,
    models.JSONField,
)
NOT_EDITABLE = (models.FileField, models.ForeignKey, models.ManyToManyField, models.OneToOneField)


class ConfigError(Exception):
    pass


def _collection_config(key: str) -> dict | None:
    collections = get_setting("COLLECTIONS") or {}
    config = collections.get(key)
    return config if isinstance(config, dict) else None


@lru_cache(maxsize=None)
def _import(path: str):
    return import_string(path)


def _model(config: dict, key: str):
    try:
        return apps.get_model(config["model"])
    except (KeyError, LookupError, ValueError) as exc:
        raise ConfigError(f'COLLECTIONS["{key}"]["model"] must be "app_label.ModelName".') from exc


def _fields(model, config: dict, key: str) -> list:
    names = config.get("fields")
    if not names or not isinstance(names, (list, tuple)):
        raise ConfigError(f'COLLECTIONS["{key}"]["fields"] must list the fields editors may change.')
    fields = []
    for name in names:
        try:
            field = model._meta.get_field(name)
        except FieldDoesNotExist as exc:
            raise ConfigError(f'COLLECTIONS["{key}"]: {model.__name__} has no field "{name}".') from exc
        if isinstance(field, NOT_EDITABLE) or not isinstance(field, EDITABLE_FIELDS):
            raise ConfigError(f'COLLECTIONS["{key}"]: the field "{name}" ({type(field).__name__}) cannot be edited here.')
        fields.append(field)
    return fields


def _queryset(model, config: dict, request):
    path = config.get("queryset")
    if path:
        source = _import(path) if isinstance(path, str) else path
        return source(request)
    return model._default_manager.all()


def _lookup(config: dict) -> str:
    return config.get("lookup") or "pk"


def _serialize(value):
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    return value


def _values(obj, fields) -> dict:
    return {field.name: _serialize(field.value_from_object(obj)) for field in fields}


def _label(obj, config: dict) -> str:
    field = config.get("label")
    value = getattr(obj, field, None) if field else None
    return str(value if value not in (None, "") else obj)


def _setup(request, key: str):
    """(config, model, fields) for an editor's request, or an error response."""
    if not KEY_PATTERN.match(key):
        return None, _error(400, "Invalid collection key.")
    config = _collection_config(key)
    if config is None:
        return None, _error(404, f"Unknown collection '{key}'. Add it to STORIO_EDITOR['COLLECTIONS'].")
    try:
        model = _model(config, key)
        return (config, model, _fields(model, config, key)), None
    except ConfigError as exc:
        return None, _error(500, str(exc))


@csrf_exempt
def collection_items(request, collection: str):
    if request.method != "GET":
        return _error(405, "Method not allowed.")
    if not _is_editor(request):
        return _error(401, "Not authorised.")
    setup, failure = _setup(request, collection)
    if failure:
        return failure
    config, model, _ = setup
    lookup = _lookup(config)
    items = [{"id": str(getattr(obj, lookup)), "label": _label(obj, config)} for obj in _queryset(model, config, request)[:1000]]
    return _json(items)


@csrf_exempt
def collection_item(request, collection: str, item_id: str):
    if request.method == "GET":
        if not _is_editor(request):
            return _error(401, "Not authorised.")
    elif request.method == "PUT":
        denied = _guard_write(request)
        if denied:
            return denied
    else:
        return _error(405, "Method not allowed.")

    setup, failure = _setup(request, collection)
    if failure:
        return failure
    config, model, fields = setup
    try:
        obj = _queryset(model, config, request).get(**{_lookup(config): item_id})
    except (model.DoesNotExist, ValueError, ValidationError):
        return _error(404, "Record not found.")

    if request.method == "GET":
        return _json(_values(obj, fields))

    try:
        raw = request.body
    except RequestDataTooBig:
        return _error(413, "Content too large.")
    if len(raw) > get_setting("MAX_BODY_BYTES"):
        return _error(413, "Content too large.")
    try:
        body = json.loads(raw or b"{}")
    except ValueError:
        return _error(400, "Body must be JSON.")
    values = body.get("values") if isinstance(body, dict) else None
    if not isinstance(values, dict):
        return _error(400, "Field 'values' must be an object.")

    by_name = {field.name: field for field in fields}
    changed = []
    errors = {}
    for name, value in values.items():
        field = by_name.get(name)
        if field is None:
            return _error(400, f"'{name}' cannot be edited.")
        try:
            setattr(obj, field.attname, field.to_python(value))
            changed.append(field.name)
        except ValidationError as exc:
            errors[name] = exc.messages
    if not errors and changed:
        others = [f.name for f in model._meta.fields if f.name not in changed]
        try:
            obj.full_clean(exclude=others)
        except ValidationError as exc:
            errors.update(exc.message_dict)
    if errors:
        first = next(iter(errors.items()))
        return _json({"detail": f"{first[0]}: {' '.join(first[1])}", "errors": errors}, status=400)

    if changed:
        obj.save(update_fields=changed)
        hook = config.get("on_save")
        if hook:
            (_import(hook) if isinstance(hook, str) else hook)(obj, request)
    return _json(_values(obj, fields))
