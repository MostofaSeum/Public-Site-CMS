"""
Include in your project:

    path("api/cms/", include("storio_elements_editor.urls")),

Trailing slashes are optional, so APPEND_SLASH never redirects a PUT or DELETE.
"""

from django.urls import re_path

from . import collection_views, views

app_name = "storio_elements_editor"

KEY = r"[A-Za-z0-9_-]{1,100}"

urlpatterns = [
    re_path(r"^records/?$", views.records, name="records"),
    re_path(rf"^records/(?P<page>{KEY})/(?P<section>{KEY})/?$", views.record, name="record"),
    re_path(r"^media/?$", views.media, name="media"),
    re_path(r"^csrf/?$", views.csrf, name="csrf"),
    re_path(r"^auth/login/?$", views.auth_login, name="auth-login"),
    re_path(r"^auth/me/?$", views.auth_me, name="auth-me"),
    re_path(rf"^collections/(?P<collection>{KEY})/items/?$", collection_views.collection_items, name="collection-items"),
    re_path(
        rf"^collections/(?P<collection>{KEY})/items/(?P<item_id>[^/]{{1,200}})/?$",
        collection_views.collection_item,
        name="collection-item",
    ),
]
