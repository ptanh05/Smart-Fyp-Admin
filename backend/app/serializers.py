from rest_framework import serializers
from .models import CustomUser, AuditLog

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "user_type", "is_active", "is_staff", "last_login", "date_joined"]


class AdminRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    admin_secret = serializers.CharField(write_only=True)


class AdminCreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    user_type = serializers.ChoiceField(choices=CustomUser.USER_TYPE_CHOICES)
    is_active = serializers.BooleanField(default=True, required=False)


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

