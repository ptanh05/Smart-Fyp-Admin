from rest_framework import serializers
from .models import CustomUser, AuditLog

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "user_type", "is_active", "is_staff", "last_login"]


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True, default="System")
    user_role = serializers.CharField(source="user.user_type", read_only=True, default="system")

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "user_role",
            "action_type",
            "evaluation_type",
            "description",
            "field_name",
            "old_value",
            "new_value",
            "created_at",
        ]
