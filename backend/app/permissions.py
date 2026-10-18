from rest_framework.permissions import BasePermission

class IsAdminUserRole(BasePermission):
    """
    Allows access to authenticated users with admin privileges or academic staff role.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(
            request.user.is_staff or 
            request.user.is_superuser or 
            getattr(request.user, 'user_type', None) in ['admin', 'academic_staff', 'giao_vu']
        )


class IsAcademicStaff(BasePermission):
    """
    Allows access to academic staff and admins.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(
            request.user.is_staff or
            request.user.is_superuser or
            getattr(request.user, 'user_type', None) in ['academic_staff', 'giao_vu', 'admin']
        )

