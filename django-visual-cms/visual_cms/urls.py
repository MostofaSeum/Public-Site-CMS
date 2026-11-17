"""
Include in your project:

    path("api/cms/", include("visual_cms.urls")),

Trailing slashes are optional, so APPEND_SLASH never redirects a PUT or DELETE.
"""

from django.urls import re_path

from . import views

app_name = "visual_cms"

KEY = r"[A-Za-z0-9_-]{1,100}"

urlpatterns = [
    re_path(r"^records/?$", views.records, name="records"),
    re_path(rf"^records/(?P<page>{KEY})/(?P<section>{KEY})/?$", views.record, name="record"),
    re_path(r"^media/?$", views.media, name="media"),
    re_path(r"^csrf/?$", views.csrf, name="csrf"),
]
