from django.db import migrations, models


def apply_utc_weight_policy(apps, schema_editor):
    """
    Chuẩn trọng số điểm tổng kết bảo vệ UTC:
    Điểm tổng kết = 0.3 × GVHD + 0.2 × GVPB + 0.5 × Hội đồng
    """
    EvaluationPolicy = apps.get_model("app", "EvaluationPolicy")
    EvaluationPolicy.objects.all().update(
        weight_supervisor=0.3,
        weight_reviewer=0.2,
        weight_council=0.5,
    )


def revert_utc_weight_policy(apps, schema_editor):
    EvaluationPolicy = apps.get_model("app", "EvaluationPolicy")
    EvaluationPolicy.objects.all().update(
        weight_supervisor=0.4,
        weight_reviewer=0.2,
        weight_council=0.4,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0004_supervisor_topic_areas"),
    ]

    operations = [
        migrations.AlterField(
            model_name="evaluationpolicy",
            name="weight_supervisor",
            field=models.FloatField(default=0.3),
        ),
        migrations.AlterField(
            model_name="evaluationpolicy",
            name="weight_reviewer",
            field=models.FloatField(default=0.2),
        ),
        migrations.AlterField(
            model_name="evaluationpolicy",
            name="weight_council",
            field=models.FloatField(default=0.5),
        ),
        migrations.RunPython(apply_utc_weight_policy, revert_utc_weight_policy),
    ]
