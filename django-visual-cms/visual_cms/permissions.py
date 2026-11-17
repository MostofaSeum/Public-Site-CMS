def is_staff_user(request) -> bool:
    """Default editor check: an active, logged-in staff user."""
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated and user.is_active and user.is_staff)
