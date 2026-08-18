from rest_framework.permissions import BasePermission

class IsAdminUserRole(BasePermission):
    """
    Allows access only to authenticated users with user_type='admin', is_staff=True, or is_superuser=True.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(
            request.user.is_staff or 
            request.user.is_superuser or 
            getattr(request.user, 'user_type', None) == 'admin'
        )
