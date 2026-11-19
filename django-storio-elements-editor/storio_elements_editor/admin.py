from django.contrib import admin

from .models import CmsRecord


@admin.register(CmsRecord)
class CmsRecordAdmin(admin.ModelAdmin):
    list_display = ("page", "section_key", "is_published", "updated_at", "updated_by")
    list_filter = ("page", "is_published")
    search_fields = ("page", "section_key")
    readonly_fields = ("created_at", "updated_at", "updated_by")
    actions = ["publish", "unpublish"]

    @admin.action(description="Publish selected sections")
    def publish(self, request, queryset):
        queryset.update(is_published=True)

    @admin.action(description="Unpublish selected sections (back to drafts)")
    def unpublish(self, request, queryset):
        queryset.update(is_published=False)
