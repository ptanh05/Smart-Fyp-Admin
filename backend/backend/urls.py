from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from app.openapi_docs import make_schema_view, make_swagger_docs_view


def health_check(request):
    return JsonResponse({"status": "ok", "service": "Smart-Fyp-Admin API"})


urlpatterns = [
    path('', health_check, name='root-health-check'),
    path('health/', health_check, name='health-check'),
    path('api/schema/', make_schema_view('Smart FYP UTC — Admin API', 'Hệ thống Quản trị Đồ án Tốt nghiệp UTC'), name='api-schema'),
    path('api/docs/', make_swagger_docs_view('Smart FYP UTC — Admin API', '/api/schema/'), name='api-docs'),
    path('django-admin/', admin.site.urls),
    path('app/', include('app.urls')),
    path('', include('app.urls')),
]

