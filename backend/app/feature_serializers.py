"""
Serializers for feature extension models (mirrored unmanaged tables).
"""
from rest_framework import serializers
from .feature_models import (
    Rubric, RubricCriterion, RubricScore, ThesisArchiveRecord, SubmissionVersion
)
from .models import AcademicBatch, GraduationProject, AuditLog


class RubricCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricCriterion
        fields = ["id", "rubric", "name", "description", "max_score", "order"]
        read_only_fields = ["id"]


class RubricSerializer(serializers.ModelSerializer):
    criteria = RubricCriterionSerializer(many=True, read_only=True)
    batch_code = serializers.SerializerMethodField()
    has_scores = serializers.SerializerMethodField()
    total_max = serializers.SerializerMethodField()

    class Meta:
        model = Rubric
        fields = [
            "id", "name", "evaluator_role", "batch", "batch_code",
            "description", "is_active", "created_at",
            "criteria", "has_scores", "total_max",
        ]
        read_only_fields = ["id", "created_at"]

    def get_batch_code(self, obj):
        if obj.batch_id:
            try:
                return AcademicBatch.objects.filter(pk=obj.batch_id).values_list("batch_code", flat=True).first()
            except Exception:
                return None
        return None

    def get_has_scores(self, obj):
        return RubricScore.objects.filter(rubric=obj).exists()

    def get_total_max(self, obj):
        return sum(c.max_score for c in obj.criteria.all())


class RubricCriterionInlineSerializer(serializers.ModelSerializer):
    """Used for nested criteria within RubricWriteSerializer (no rubric FK needed)."""
    id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = RubricCriterion
        fields = ["id", "name", "description", "max_score", "order"]


class RubricWriteSerializer(serializers.ModelSerializer):
    criteria = RubricCriterionInlineSerializer(many=True, required=False)

    class Meta:
        model = Rubric
        fields = ["id", "name", "evaluator_role", "batch", "description", "is_active", "criteria"]

    def create(self, validated_data):
        criteria_data = validated_data.pop("criteria", [])
        rubric = Rubric.objects.create(**validated_data)
        for i, cdata in enumerate(criteria_data):
            cdata.pop("id", None)
            cdata.setdefault("order", i)
            RubricCriterion.objects.create(rubric=rubric, **cdata)
        return rubric

    def update(self, instance, validated_data):
        criteria_data = validated_data.pop("criteria", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if criteria_data is not None:
            existing_map = {c.id: c for c in instance.criteria.all()}
            kept_ids = set()
            for i, cdata in enumerate(criteria_data):
                cid = cdata.pop("id", None)
                cdata.setdefault("order", i)
                if cid is not None and cid in existing_map:
                    crit = existing_map[cid]
                    for attr, val in cdata.items():
                        setattr(crit, attr, val)
                    crit.save()
                    kept_ids.add(cid)
                else:
                    new_crit = RubricCriterion.objects.create(rubric=instance, **cdata)
                    kept_ids.add(new_crit.id)

            removed_ids = [cid for cid in existing_map.keys() if cid not in kept_ids]
            if removed_ids:
                instance.criteria.filter(id__in=removed_ids).delete()
        return instance


class SubmissionVersionMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionVersion
        fields = ["id", "kind", "version_no", "original_name", "file_size", "created_at"]


class ThesisArchiveRecordSerializer(serializers.ModelSerializer):
    project_title = serializers.SerializerMethodField()
    student_code = serializers.SerializerMethodField()
    batch_code = serializers.SerializerMethodField()
    is_embargoed = serializers.SerializerMethodField()
    final_version_info = serializers.SerializerMethodField()

    class Meta:
        model = ThesisArchiveRecord
        fields = [
            "id", "project", "project_title", "student_code", "batch_code",
            "title", "abstract", "keywords",
            "final_version", "final_version_info",
            "visibility", "embargo_until", "embargo_reason",
            "license", "final_score",
            "archived_by", "archived_at",
            "is_embargoed",
        ]
        read_only_fields = ["id", "archived_at"]

    def get_project_title(self, obj):
        try:
            proj = GraduationProject.objects.select_related("student").filter(pk=obj.project_id).first()
            if proj:
                return proj.topic_title_vi
        except Exception:
            pass
        return ""

    def get_student_code(self, obj):
        try:
            proj = GraduationProject.objects.select_related("student").filter(pk=obj.project_id).first()
            if proj and proj.student_id:
                return proj.student.registration_no
        except Exception:
            pass
        return ""

    def get_batch_code(self, obj):
        try:
            proj = GraduationProject.objects.select_related("batch").filter(pk=obj.project_id).first()
            if proj and proj.batch_id:
                return proj.batch.batch_code
        except Exception:
            pass
        return ""

    def get_is_embargoed(self, obj):
        return obj.is_embargoed

    def get_final_version_info(self, obj):
        if obj.final_version_id:
            try:
                v = SubmissionVersion.objects.filter(pk=obj.final_version_id).first()
                if v:
                    return SubmissionVersionMinimalSerializer(v).data
            except Exception:
                pass
        return None


class AuditLogFeatureSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "user", "user_name", "action_type",
            "description", "field_name", "old_value", "new_value",
            "evaluation_type", "ip_address", "created_at",
        ]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return None
