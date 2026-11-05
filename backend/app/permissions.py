from rest_framework.permissions import BasePermission, SAFE_METHODS


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


class IsSuperAdminOnly(BasePermission):
    """
    Chỉ dành cho Admin hệ thống (super admin / admin role).
    Giáo vụ Khoa (academic_staff) KHÔNG được truy cập các API quản trị hệ thống
    như: Quản lý tài khoản, Quản lý giảng viên, Trung tâm bảo mật, Nhật ký hệ thống.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user_type = getattr(request.user, 'user_type', None)
        return bool(
            request.user.is_superuser
            or user_type == 'admin'
            or (request.user.is_staff and user_type not in ['academic_staff', 'giao_vu'])
        )


class IsSuperAdminOnlyForWrite(BasePermission):
    """
    Đọc: Admin + Giáo vụ Khoa được phép (cần cho các trang nghiệp vụ GĐ1 như
    xem danh sách sinh viên / giảng viên trong đợt).
    Ghi (POST/PATCH/PUT/DELETE): CHỈ Admin hệ thống được phép.

    Dùng cho các API dùng chung giữa Admin và Giáo vụ Khoa, tránh để Giáo vụ Khoa
    tạo / sửa / xoá tài khoản hoặc cấu hình hệ thống.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return IsAdminUserRole().has_permission(request, view)
        return IsSuperAdminOnly().has_permission(request, view)


class IsSuperAdminOnlyOrStaffStudentWrite(BasePermission):
    """
    Quản lý tài khoản người dùng:
    - GET: Admin + Giáo vụ Khoa (cần cho trang GĐ1 xem SV/GV trong đợt).
    - POST:
        * Admin hệ thống: tạo được mọi loại tài khoản.
        * Giáo vụ Khoa: CHỈ được tạo tài khoản SINH VIÊN (nghiệp vụ GĐ1).
    - PATCH / PUT / DELETE: CHỈ Admin hệ thống.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if IsSuperAdminOnly().has_permission(request, view):
            return True
        if not IsAdminUserRole().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return True
        if request.method == "POST":
            user_type = (request.data or {}).get("user_type")
            return user_type == "student"
        return False
