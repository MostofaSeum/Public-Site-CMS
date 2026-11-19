from django.apps import AppConfig


class StorioElementsEditorConfig(AppConfig):
    name = "storio_elements_editor"
    # The label from before the rename keeps existing tables (visual_cms_cmsrecord) and
    # migration history, so upgrading needs no database change.
    label = "visual_cms"
    verbose_name = "Storio Elements Editor"
    default_auto_field = "django.db.models.BigAutoField"
