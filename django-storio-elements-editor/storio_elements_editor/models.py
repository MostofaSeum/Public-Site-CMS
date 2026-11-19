from django.conf import settings
from django.db import models


class CmsRecord(models.Model):
    """
    A saved override for one section of one page. Sections that were never
    edited have no row and show the defaults defined in the frontend config.
    Deleting a row resets that section to its default.
    """

    page = models.CharField(max_length=100, db_index=True)
    section_key = models.CharField(max_length=100)
    content = models.JSONField()
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="visual_cms_records",
    )

    class Meta:
        verbose_name = "CMS section"
        verbose_name_plural = "CMS sections"
        ordering = ["page", "section_key"]
        constraints = [
            models.UniqueConstraint(fields=["page", "section_key"], name="visual_cms_unique_page_section"),
        ]

    def __str__(self) -> str:
        return f"{self.page} / {self.section_key}"

    def to_dict(self) -> dict:
        """Serialise in the shape the JS library expects (SectionRecord)."""
        user = self.updated_by
        return {
            "page": self.page,
            "sectionKey": self.section_key,
            "content": self.content,
            "isPublished": self.is_published,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "updatedBy": user.get_username() if user else None,
        }
