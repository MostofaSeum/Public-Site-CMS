from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/cms/", include("storio_elements_editor.urls")),
]
